import "reflect-metadata";
import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createHmac, randomUUID } from "node:crypto";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { Reflector } from "@nestjs/core";
import { ValidationPipe } from "@nestjs/common";
import { BrowserMutationGuard } from "../auth/browser-mutation.guard";
import { RequestAuthenticationService } from "../auth/request-authentication.service";
import { AuthRateLimitService } from "../auth/auth-rate-limit.service";
import { SecurityPolicyService } from "../auth/security-policy.service";
import { UserLifecycleController } from "./user-lifecycle.controller";
import { AdminUsersController } from "./admin-users.controller";
import { AdminUsersService } from "./admin-users.service";
import { AdminUserNotesController } from "./admin-user-notes.controller";
import { AdminUserNotesService } from "./admin-user-notes.service";
import { OtpService } from "../sms/otp.service";
import type { SmsService } from "../sms/sms.service";
import type { SmsSettingsService } from "../sms/sms-settings.service";
import { PrismaService } from "../../prisma/prisma.service";
import { assertDedicatedTestDatabase } from "../../test/test-database";
import { AuthService } from "../auth/auth.service";
import { AuthLoginSettingsService } from "../auth/auth-login-settings.service";
import { UserLifecycleService } from "./user-lifecycle.service";
import { UserDeletionService } from "./user-deletion.service";
import { UserTransferWorker } from "./user-transfer.worker";
import type { ManagedUserRole } from "@topgsm/shared-types";

assertDedicatedTestDatabase();
const prisma = new PrismaService();
const auth = new AuthService(prisma, new AuthLoginSettingsService(prisma));
const lifecycle = new UserLifecycleService(prisma, auth);
const deletions = new UserDeletionService(prisma, auth);
const config = new ConfigService({ DISABLE_BACKGROUND_WORKERS: "true" });
let admin: string; let passwordHash: string;
const password = "Lifecycle test password 42!";
async function user(role: ManagedUserRole = "buyer") {
  return prisma.users.create({ data: { full_name: "Lifecycle fixture", email: `${randomUUID()}@example.test`, role, password_hash: passwordHash } });
}
async function seller() {
  const owner = await user("seller_admin");
  const organization = await prisma.sellers.create({ data: { user_id: owner.id, shop_name: randomUUID(), approved: true } });
  await prisma.seller_memberships.create({ data: { user_id: owner.id, seller_id: organization.id, role: "admin" } });
  return { owner, organization };
}
async function finish(jobId: string, max = 200) {
  // Recreate the worker every batch: durable progress must not depend on memory.
  for (let i = 0; i < max; i++) {
    const job = await prisma.user_deletion_jobs.findUniqueOrThrow({ where: { id: jobId } });
    if (job.status === "completed") return job;
    assert.notEqual(job.status, "failed", JSON.stringify(job));
    assert.equal(await new UserTransferWorker(prisma, config).tick(error => { throw error; }), true, JSON.stringify(job));
  }
  throw new Error("Transfer did not finish in bounded batches");
}
before(async () => { await prisma.$connect(); passwordHash = await auth.createPasswordHash(password); admin = (await user("platform_admin")).id; });
after(async () => { await prisma.$disconnect(); });

describe("Account lifecycle PostgreSQL invariants", () => {
  it("enforces real HTTP authorization, exact origin, DTO validation, password confirmation and rate limits", async () => {
    const limits = new AuthRateLimitService(prisma, new SecurityPolicyService(prisma));
    const webConfig = new ConfigService({ WEB_ORIGIN: "http://localhost:3000" });
    const module = await Test.createTestingModule({ controllers: [UserLifecycleController, AdminUsersController, AdminUserNotesController], providers: [
      { provide: UserLifecycleService, useValue: lifecycle }, { provide: UserDeletionService, useValue: deletions },
      { provide: AdminUsersService, useValue: new AdminUsersService(prisma, auth) },
      { provide: AdminUserNotesService, useValue: new AdminUserNotesService(prisma) },
      { provide: AuthService, useValue: auth },
      { provide: AuthRateLimitService, useValue: limits }, { provide: RequestAuthenticationService, useValue: new RequestAuthenticationService(auth) }
    ] }).compile();
    const app = module.createNestApplication({ logger: false });
    app.useGlobalGuards(new BrowserMutationGuard(new Reflector(), webConfig));
    app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
    await app.listen(0, "127.0.0.1");
    try {
      const base = await app.getUrl(); const target = await user(); const other = await user("platform_staff");
      const ownerSession = await auth.createSessionForUser(admin); const staffSession = await auth.createSessionForUser(other.id);
      const path = `${base}/admin/users/${target.id}`;
      assert.equal((await fetch(`${path}/access`)).status, 401);
      assert.equal((await fetch(`${path}/access`, { headers: { authorization: `Bearer ${staffSession.token}` } })).status, 403);
      const headers = { "content-type": "application/json", cookie: `topgsm_session=${ownerSession.token}`, origin: "http://localhost:3000" };
      const statusBody = JSON.stringify({ status: "blocked", reason: "HTTP block test" });
      assert.equal((await fetch(`${path}/status`, { method: "PATCH", headers: { ...headers, origin: "http://evil.example" }, body: statusBody })).status, 403);
      assert.equal((await fetch(`${path}/status`, { method: "PATCH", headers: { "content-type": "application/json", authorization: `Bearer ${ownerSession.token}` }, body: statusBody })).status, 403);
      assert.equal((await fetch(`${path}/status`, { method: "PATCH", headers, body: JSON.stringify({ status: "deleted", reason: "Invalid direct deletion" }) })).status, 400);
      const input = { idempotencyKey: randomUUID(), reason: "HTTP deletion test", confirmation: target.email, currentPassword: "wrong-password" };
      assert.equal((await fetch(`${path}/deletion-jobs`, { method: "POST", headers, body: JSON.stringify(input) })).status, 401);
      assert.equal((await fetch(`${path}/deletion-jobs`, { method: "POST", headers, body: JSON.stringify({ ...input, currentPassword: password, confirmation: "wrong identifier" }) })).status, 400);
      const codeTarget = await user(); const codeReplacement = await user();
      const codePath = `${base}/admin/users/${codeTarget.support_code.toLowerCase()}`;
      const authorized = { cookie: `topgsm_session=${ownerSession.token}` };
      assert.equal((await fetch(codePath, { headers: authorized })).status, 200);
      assert.equal((await fetch(`${codePath}/history?section=orders`, { headers: authorized })).status, 200);
      assert.equal((await fetch(codePath, { method: "PATCH", headers, body: JSON.stringify({ fullName: "Code Lookup Account" }) })).status, 200);
      assert.equal((await fetch(`${codePath}/password`, { method: "PATCH", headers, body: JSON.stringify({ currentPassword: password, newPassword: "New user password 42!" }) })).status, 200);
      assert.equal((await fetch(`${codePath}/notes`, { headers: authorized })).status, 200);
      assert.equal((await fetch(`${codePath}/notes`, { method: "POST", headers, body: JSON.stringify({ body: "Support code note" }) })).status, 201);
      assert.equal((await fetch(`${codePath}/access`, { headers: authorized })).status, 200);
      assert.equal((await fetch(`${codePath}/account-events`, { headers: authorized })).status, 200);
      assert.equal((await fetch(`${codePath}/role-sellers`, { headers: authorized })).status, 200);
      assert.equal((await fetch(`${codePath}/replacements?cursor=${codeReplacement.support_code.toLowerCase()}`, { headers: authorized })).status, 200);
      assert.equal((await fetch(`${codePath}/deletion-impact?replacementUserId=${codeReplacement.support_code.toLowerCase()}`, { headers: authorized })).status, 200);
      assert.equal((await fetch(`${codePath}/role`, { method: "PATCH", headers, body: JSON.stringify({ role: "buyer", reason: "Support code role test" }) })).status, 200);
      assert.equal((await fetch(`${codePath}/status`, { method: "PATCH", headers, body: statusBody })).status, 200);
      const codeJobResponse = await fetch(`${codePath}/deletion-jobs`, { method: "POST", headers, body: JSON.stringify({ idempotencyKey: randomUUID(), reason: "Support code deletion test", currentPassword: password, confirmation: codeTarget.support_code, replacementUserId: codeReplacement.support_code.toLowerCase() }) });
      assert.equal(codeJobResponse.status, 201);
      const codeJob = await codeJobResponse.json() as { id: string; userId: string; replacementUserId: string };
      assert.equal(codeJob.userId, codeTarget.id);
      assert.equal(codeJob.replacementUserId, codeReplacement.id);
      assert.equal((await fetch(`${codePath}/deletion-jobs/${codeJob.id}`, { headers: authorized })).status, 200);
      await prisma.user_deletion_jobs.update({ where: { id: codeJob.id }, data: { status: "failed" } });
      assert.equal((await fetch(`${codePath}/deletion-jobs/${codeJob.id}/retry`, { method: "POST", headers })).status, 201);
      let limited = false;
      for (let i = 0; i < 200; i++) {
        try { await limits.consumeAdminUserOperation(admin, "127.0.0.1"); } catch { limited = true; break; }
      }
      assert.equal(limited, true);
      assert.equal((await fetch(`${path}/deletion-jobs`, { method: "POST", headers, body: JSON.stringify({ ...input, currentPassword: password }) })).status, 429);
      assert.equal(await prisma.user_deletion_jobs.count({ where: { user_id: target.id } }), 0);
    } finally { await app.close(); }
  });
  it("supports all 25 non-owner role transitions and replaces permissions/memberships while preserving blocked status", async () => {
    const { organization } = await seller();
    const roles: ManagedUserRole[] = ["buyer", "seller_staff", "seller_admin", "platform_staff", "platform_admin"];
    for (const from of roles) for (const to of roles) {
      const target = await user(from);
      await prisma.users.update({ where: { id: target.id }, data: { account_status: "blocked" } });
      await prisma.platform_staff_permissions.create({ data: { user_id: target.id, permission: "orders_manage", granted_by_id: admin } });
      await prisma.seller_memberships.create({ data: { user_id: target.id, seller_id: organization.id, role: "staff" } });
      const access = await lifecycle.setRole(target.id, admin, { role: to, reason: "Role transition test", currentPassword: password, confirmation: target.email!, ...(to.startsWith("seller_") ? { sellerId: organization.id } : {}), ...(to === "platform_staff" ? { permissions: ["catalog_view"] } : {}) });
      assert.equal(access.role, to); assert.equal(access.status, "blocked");
      assert.deepEqual(access.platformPermissions, to === "platform_staff" ? ["catalog_view"] : []);
      assert.equal(access.memberships.length, to.startsWith("seller_") ? 1 : 0);
      if (access.memberships[0]) assert.equal(access.memberships[0].role, to === "seller_admin" ? "admin" : "staff");
    }
  });

  it("blocks self-mutations, owner demotion, missing privileged confirmation and terminal changes", async () => {
    const { owner, organization } = await seller();
    await assert.rejects(lifecycle.setRole(owner.id, admin, { role: "buyer", reason: "Invalid owner change", currentPassword: password, confirmation: owner.email! }));
    await assert.rejects(lifecycle.setRole(admin, admin, { role: "buyer", reason: "Self demotion test" }));
    await assert.rejects(lifecycle.setStatus(admin, admin, { status: "blocked", reason: "Self block test" }));
    const target = await user();
    await assert.rejects(lifecycle.setRole(target.id, admin, { role: "platform_admin", reason: "Missing confirmation" }));
    await assert.rejects(lifecycle.setRole(target.id, admin, { role: "seller_admin", sellerId: organization.id, reason: "Wrong confirmation", currentPassword: password, confirmation: "wrong" }));
    await assert.rejects(lifecycle.setRole(target.id, admin, { role: "platform_staff", reason: "Missing permission choice" }));
    await prisma.users.update({ where: { id: target.id }, data: { account_status: "deletion_pending" } });
    await assert.rejects(lifecycle.setRole(target.id, admin, { role: "buyer", reason: "Pending account" }));
  });

  it("blocks password, token and future session creation without suspending the seller", async () => {
    const { owner, organization } = await seller();
    const session = await auth.login({ identifier: owner.email!, password });
    await lifecycle.setStatus(owner.id, admin, { status: "blocked", reason: "Block authentication test" });
    await assert.rejects(auth.login({ identifier: owner.email!, password }));
    await assert.rejects(auth.getUserFromToken(session.token));
    await assert.rejects(auth.createSessionForUser(owner.id));
    await assert.rejects(prisma.auth_sessions.create({ data: { user_id: owner.id, token_hash: randomUUID(), expires_at: new Date(Date.now() + 60_000) } }));
    assert.equal((await prisma.sellers.findUniqueOrThrow({ where: { id: organization.id } })).suspended_at, null);
    await lifecycle.setStatus(owner.id, admin, { status: "active", reason: "Manual unblock test" });
    await auth.login({ identifier: owner.email!, password });
    await assert.rejects(auth.getUserFromToken(session.token));
  });

  it("serializes concurrent administrator blocking so an active administrator remains", async () => {
    const second = await user("platform_admin");
    const outcomes = await Promise.allSettled([
      lifecycle.setStatus(second.id, admin, { status: "blocked", reason: "Concurrent admin test" }),
      lifecycle.setStatus(admin, second.id, { status: "blocked", reason: "Concurrent admin test" })
    ]);
    assert.equal(outcomes.filter(r => r.status === "fulfilled").length, 1);
    assert.equal(await prisma.users.count({ where: { role: "platform_admin", account_status: "active" } }), 1);
    const active = await prisma.users.findFirstOrThrow({ where: { role: "platform_admin", account_status: "active" } });
    admin = active.id;
  });

  it("rejects blocked/pending OTP and destroys outstanding OTP challenges on deletion", async () => {
    const target = await user(); const phone = "+989121234567"; const secret = "t".repeat(40); const code = "123456"; const challengeId = randomUUID();
    await prisma.users.update({ where: { id: target.id }, data: { phone_number: phone } });
    await prisma.otp_challenges.create({ data: { id: challengeId, phone_number: phone, expires_at: new Date(Date.now() + 300_000), code_hash: createHmac("sha256", secret).update(`${challengeId}:${phone}:${code}`).digest("hex") } });
    const otp = new OtpService(prisma, auth, {} as SmsService, new ConfigService({ OTP_HMAC_KEY: secret }), { isOtpEnabled: async () => true } as unknown as SmsSettingsService, new AuthLoginSettingsService(prisma));
    await lifecycle.setStatus(target.id, admin, { status: "blocked", reason: "Block OTP test" });
    await assert.rejects(otp.verify({ challengeId, phoneNumber: phone, code }));
    const job = await deletions.enqueue(target.id, admin, { idempotencyKey: randomUUID(), reason: "Delete OTP account", currentPassword: password, confirmation: target.email! });
    await assert.rejects(otp.verify({ challengeId, phoneNumber: phone, code }));
    await finish(job.id);
    assert.equal(await prisma.otp_challenges.count({ where: { id: challengeId } }), 0);
    await assert.rejects(otp.verify({ challengeId, phoneNumber: phone, code, fullName: "Do not recreate" }));
  });

  it("rejects ambiguous/platform replacements; selecting a role deactivates competing memberships and revokes sessions", async () => {
    const first = await seller(); const second = await seller(); const target = await user();
    await prisma.seller_memberships.create({ data: { seller_id: first.organization.id, user_id: target.id, role: "staff" } });
    await assert.rejects(prisma.seller_memberships.create({ data: { seller_id: second.organization.id, user_id: target.id, role: "staff" } }));
    // The existing partial unique index prevents two active memberships, but
    // canonical ownership plus a different active membership is still possible.
    await prisma.seller_memberships.updateMany({ where: { user_id: first.owner.id }, data: { active: false } });
    await prisma.seller_memberships.create({ data: { seller_id: second.organization.id, user_id: first.owner.id, role: "staff" } });
    await assert.rejects(deletions.impact(second.owner.id, first.owner.id));
    await assert.rejects(deletions.impact(first.owner.id, admin));
    const session = await auth.createSessionForUser(target.id);
    await lifecycle.setRole(target.id, admin, { role: "seller_staff", sellerId: second.organization.id, reason: "Choose one seller context" });
    assert.equal(await prisma.seller_memberships.count({ where: { user_id: target.id, active: true } }), 1);
    await assert.rejects(auth.getUserFromToken(session.token));
    assert.equal((await deletions.impact(first.owner.id, target.id)).destinationSellerId, second.organization.id);
  });

  it("SKIP LOCKED allows a second worker to advance a different job", async () => {
    const first = await user(); const second = await user();
    const enqueue = (target: typeof first) => deletions.enqueue(target.id, admin, { idempotencyKey: randomUUID(), reason: "Concurrent worker test", currentPassword: password, confirmation: target.email! });
    const a = await enqueue(first); const b = await enqueue(second);
    await prisma.$transaction(async tx => {
      await tx.$queryRaw`SELECT id FROM user_deletion_jobs WHERE id=${a.id}::uuid FOR UPDATE`;
      assert.equal(await new UserTransferWorker(prisma, config).tick(error => { throw error; }), true);
      assert.equal((await tx.user_deletion_jobs.findUniqueOrThrow({ where: { id: a.id } })).phase, 0);
      assert.equal((await tx.user_deletion_jobs.findUniqueOrThrow({ where: { id: b.id } })).phase, 1);
    });
    await finish(a.id); await finish(b.id);
  });

  it("rolls back a failed batch and stops after three failures until explicit retry", async () => {
    const source = await user(); const recipient = await user(); const post = await prisma.blog_posts.create({ data: { creator_user_id: recipient.id } });
    const comment = await prisma.comments.create({ data: { author_user_id: source.id, blog_post_id: post.id, body: "Atomic batch" } });
    const job = await deletions.enqueue(source.id, admin, { idempotencyKey: randomUUID(), reason: "Failure recovery test", currentPassword: password, confirmation: source.email!, replacementUserId: recipient.id });
    await prisma.$executeRawUnsafe("CREATE FUNCTION lifecycle_test_failure() RETURNS TRIGGER LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'simulated failure'; END $$");
    await prisma.$executeRawUnsafe("CREATE TRIGGER lifecycle_test_failure BEFORE UPDATE ON comments FOR EACH ROW EXECUTE FUNCTION lifecycle_test_failure()");
    try {
      for (let i = 0; i < 12; i++) {
        await new UserTransferWorker(prisma, config).tick();
        const current = await prisma.user_deletion_jobs.findUniqueOrThrow({ where: { id: job.id } });
        if (current.status === "failed") break;
        await prisma.user_deletion_jobs.update({ where: { id: job.id }, data: { next_attempt_at: new Date(0) } });
      }
      const failed = await prisma.user_deletion_jobs.findUniqueOrThrow({ where: { id: job.id } });
      assert.equal(failed.status, "failed"); assert.equal(failed.attempts, 3);
      assert.equal((await prisma.comments.findUniqueOrThrow({ where: { id: comment.id } })).author_user_id, source.id);
      assert.equal((await prisma.users.findUniqueOrThrow({ where: { id: source.id } })).account_status, "deletion_pending");
    } finally {
      await prisma.$executeRawUnsafe("DROP TRIGGER lifecycle_test_failure ON comments");
      await prisma.$executeRawUnsafe("DROP FUNCTION lifecycle_test_failure()");
    }
    await deletions.retry(source.id, job.id, admin); await finish(job.id);
    assert.equal((await prisma.comments.findUniqueOrThrow({ where: { id: comment.id } })).author_user_id, recipient.id);
  });

  it("hands the seller to a buyer and keeps product identity; wrong confirmation and open orders block deletion", async () => {
    const { owner, organization } = await seller(); const recipient = await user();
    const product = await prisma.products.create({ data: { title: "Handoff", slug: randomUUID(), description: "", type: "physical", created_by_seller_id: organization.id } });
    const order = await prisma.orders.create({ data: { buyer_id: recipient.id, seller_id: organization.id, currency: "TOMAN", total_amount: "1", commission_rate: "0", holdback_rate: "0", idempotency_key: randomUUID(), request_hash: "a".repeat(64) } });
    const input = { reason: "Handoff lifecycle test", idempotencyKey: randomUUID(), currentPassword: password, confirmation: owner.email!, replacementUserId: recipient.id };
    await assert.rejects(deletions.enqueue(owner.id, admin, { ...input, confirmation: "wrong" }));
    await assert.rejects(deletions.enqueue(owner.id, admin, input));
    await prisma.orders.update({ where: { id: order.id }, data: { status: "cancelled" } });
    const job = await deletions.enqueue(owner.id, admin, input);
    assert.equal((await deletions.enqueue(owner.id, admin, input)).id, job.id);
    await finish(job.id);
    assert.equal((await prisma.sellers.findUniqueOrThrow({ where: { id: organization.id } })).user_id, recipient.id);
    assert.equal((await prisma.products.findUniqueOrThrow({ where: { id: product.id } })).created_by_seller_id, organization.id);
    assert.equal((await prisma.users.findUniqueOrThrow({ where: { id: recipient.id } })).role, "seller_admin");
    const tombstone = await prisma.users.findUniqueOrThrow({ where: { id: owner.id } });
    assert.equal(tombstone.account_status, "deleted"); assert.equal(tombstone.email, null); assert.equal(tombstone.password_hash, null);
    await assert.rejects(prisma.users.update({ where: { id: owner.id }, data: { full_name: "Resurrection" } }));
    await assert.rejects(auth.createSessionForUser(owner.id));
  });

  it("transfers 10,000 products in bounded resumable batches; conflicts and historical identities are preserved", async () => {
    const source = await seller(); const destination = await seller(); const buyer = await user();
    for (let page = 0; page < 10; page++) {
      await prisma.products.createMany({ data: Array.from({ length: 1000 }, (_, i) => ({ id: randomUUID(), title: `Transfer ${page * 1000 + i}`, description: "", slug: randomUUID(), type: "physical" as const, created_by_seller_id: source.organization.id })) });
    }
    const products = await prisma.products.findMany({ where: { created_by_seller_id: source.organization.id }, take: 3, orderBy: { id: "asc" } });
    const listing = await prisma.seller_listings.create({ data: { seller_id: source.organization.id, product_id: products[0].id, status: "active" } });
    const kept = await prisma.seller_listings.create({ data: { seller_id: destination.organization.id, product_id: products[0].id, status: "active" } });
    const moved = await prisma.seller_listings.create({ data: { seller_id: source.organization.id, product_id: products[1].id, status: "active" } });
    await prisma.products.update({ where: { id: products[2].id }, data: { type: "bridge" } });
    const bridge = await prisma.seller_listings.create({ data: { seller_id: source.organization.id, product_id: products[2].id, status: "active" } });
    const coupon = await prisma.coupons.create({ data: { seller_id: source.organization.id, code: "SAME", discount_type: "percentage", discount_value: "5", currency: "TOMAN" } });
    await prisma.coupons.create({ data: { seller_id: destination.organization.id, code: "SAME", discount_type: "percentage", discount_value: "10", currency: "TOMAN" } });
    const post = await prisma.blog_posts.create({ data: { creator_user_id: source.owner.id, seller_id: source.organization.id } });
    const media = await prisma.blog_media_assets.create({ data: { owner_user_id: source.owner.id, seller_id: source.organization.id, kind: "cover", width: 100, height: 100, byte_size: 100, checksum: "a".repeat(64) } });
    const comment = await prisma.comments.create({ data: { blog_post_id: post.id, body: "Transfer comment", status: "spam_review", author_user_id: source.owner.id, flagged_by_user_id: source.owner.id } });
    await prisma.comment_assignments.create({ data: { comment_id: comment.id, assignee_kind: "seller", assignee_key: `seller:${source.organization.id}`, seller_id: source.organization.id } });
    const order = await prisma.orders.create({ data: { buyer_id: source.owner.id, seller_id: source.organization.id, status: "delivered", currency: "TOMAN", total_amount: "1", commission_rate: "0", holdback_rate: "0", idempotency_key: randomUUID(), request_hash: "a".repeat(64) } });
    const variant = await prisma.product_variants.create({ data: { product_id: products[1].id, option_signature: "a".repeat(64) } });
    const offer = await prisma.seller_offers.create({ data: { listing_id: moved.id, variant_id: variant.id, price: "1", currency: "TOMAN", physical: { create: { stock: 1, weight_grams: 1 } } } });
    const historicalItem = await prisma.order_items.create({ data: { order_id: order.id, offer_id: offer.id, product_type: "physical", product_title: "Historical product title", quantity: 1, unit_price: "1", total_amount: "1" } });
    await assert.rejects(prisma.seller_listings.update({ where: { id: moved.id }, data: { seller_id: destination.organization.id } }));
    const payout = await prisma.payout_ledger.create({ data: { order_id: order.id, seller_id: source.organization.id, status: "settled", gross_amount: "1", commission_amount: "0", holdback_amount: "0", payable_amount: "1", currency: "TOMAN" } });
    const audit = await prisma.order_events.create({ data: { order_id: order.id, actor_user_id: source.owner.id, to_status: "delivered", idempotency_key: randomUUID(), request_hash: "a".repeat(64) } });
    const input = { reason: "Large seller merge test", idempotencyKey: randomUUID(), currentPassword: password, confirmation: source.owner.email!, replacementUserId: destination.owner.id };
    const impact = await deletions.impact(source.owner.id, destination.owner.id);
    assert.equal(impact.counts.products, 10_000); assert.equal(impact.conflicts.listings, 1); assert.equal(impact.conflicts.bridge, 1);
    const job = await deletions.enqueue(source.owner.id, admin, input);
    await assert.rejects(prisma.products.create({ data: { title: "Race", description: "", slug: randomUUID(), type: "physical", created_by_seller_id: source.organization.id } }));
    await assert.rejects(prisma.orders.create({ data: { buyer_id: buyer.id, seller_id: destination.organization.id, currency: "TOMAN", total_amount: "1", commission_rate: "0", holdback_rate: "0", idempotency_key: randomUUID(), request_hash: "a".repeat(64) } }));
    assert.equal(await new UserTransferWorker(prisma, config).tick(), true);
    assert.equal(await prisma.products.count({ where: { created_by_seller_id: destination.organization.id } }), 200);
    // Simulate a process loss after commit and require explicit failed-job retry.
    await prisma.user_deletion_jobs.update({ where: { id: job.id }, data: { status: "failed", error_code: "SIMULATED_CRASH" } });
    assert.equal((await prisma.users.findUniqueOrThrow({ where: { id: source.owner.id } })).account_status, "deletion_pending");
    await deletions.retry(source.owner.id, job.id, admin);
    const completed = await finish(job.id);
    assert.equal((completed.progress as Record<string, { transferred: number }>).products.transferred, 10_000);
    assert.equal(await prisma.products.count({ where: { created_by_seller_id: destination.organization.id } }), 10_000);
    assert.equal((await prisma.seller_listings.findUniqueOrThrow({ where: { id: listing.id } })).status, "archived");
    assert.equal((await prisma.seller_listings.findUniqueOrThrow({ where: { id: kept.id } })).status, "active");
    assert.equal((await prisma.seller_listings.findUniqueOrThrow({ where: { id: moved.id } })).seller_id, destination.organization.id);
    assert.equal((await prisma.seller_listings.findUniqueOrThrow({ where: { id: bridge.id } })).status, "archived");
    assert.equal((await prisma.coupons.findUniqueOrThrow({ where: { id: coupon.id } })).active, false);
    assert.equal((await prisma.blog_posts.findUniqueOrThrow({ where: { id: post.id } })).creator_user_id, destination.owner.id);
    assert.equal((await prisma.blog_media_assets.findUniqueOrThrow({ where: { id: media.id } })).owner_user_id, destination.owner.id);
    const transferredComment = await prisma.comments.findUniqueOrThrow({ where: { id: comment.id } });
    assert.equal(transferredComment.author_user_id, destination.owner.id); assert.equal(transferredComment.flagged_by_user_id, source.owner.id);
    const historical = await prisma.orders.findUniqueOrThrow({ where: { id: order.id } });
    assert.equal(historical.buyer_id, source.owner.id); assert.equal(historical.seller_id, source.organization.id);
    assert.equal((await prisma.order_items.findUniqueOrThrow({ where: { id: historicalItem.id } })).offer_id, offer.id);
    assert.equal((await prisma.payout_ledger.findUniqueOrThrow({ where: { id: payout.id } })).seller_id, source.organization.id);
    assert.equal((await prisma.order_events.findUniqueOrThrow({ where: { id: audit.id } })).actor_user_id, source.owner.id);
    assert.equal((await prisma.sellers.findUniqueOrThrow({ where: { id: source.organization.id } })).merged_into_seller_id, destination.organization.id);
    assert.equal(await prisma.user_lifecycle_locks.count({ where: { job_id: job.id } }), 0);
    await assert.rejects(prisma.sellers.update({ where: { id: source.organization.id }, data: { suspended_at: null } }));
    await assert.rejects(prisma.blog_posts.create({ data: { creator_user_id: source.owner.id } }));
    await assert.rejects(deletions.retry(source.owner.id, job.id, admin));
  });
});
