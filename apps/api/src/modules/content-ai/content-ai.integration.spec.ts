import assert from "node:assert/strict";
import { after, before, it } from "node:test";
import { randomUUID } from "node:crypto";
import type { AppUser } from "@topgsm/shared-types";
import { assertDedicatedTestDatabase } from "../../test/test-database";
import { PrismaService } from "../../prisma/prisma.service";
import { AuthRateLimitService } from "../auth/auth-rate-limit.service";
import { SecurityPolicyService } from "../auth/security-policy.service";
import { ContentAiService } from "./content-ai.service";

assertDedicatedTestDatabase();
const prisma = new PrismaService();
const limits = new AuthRateLimitService(prisma, new SecurityPolicyService(prisma));
const service = new ContentAiService(prisma, {} as never, {} as never, limits);
const ids = { owner: randomUUID(), staff: randomUUID(), other: randomUUID(), seller: randomUUID(), otherSeller: randomUUID() };
const actor = (id: string, role: AppUser["role"] = "seller-admin"): AppUser => ({ id, role, fullName: "AI test", email: null });

before(async () => {
  await prisma.$connect();
  await prisma.users.createMany({ data: [{ id: ids.owner, full_name: "Owner", email: `${ids.owner}@example.test`, role: "seller_admin" }, { id: ids.staff, full_name: "Staff", email: `${ids.staff}@example.test`, role: "seller_staff" }, { id: ids.other, full_name: "Other", email: `${ids.other}@example.test`, role: "seller_admin" }] });
  await prisma.sellers.createMany({ data: [{ id: ids.seller, user_id: ids.owner, shop_name: "AI test", approved: true }, { id: ids.otherSeller, user_id: ids.other, shop_name: "Other", approved: true }] });
  await prisma.seller_memberships.createMany({ data: [{ seller_id: ids.seller, user_id: ids.owner, role: "admin", active: true }, { seller_id: ids.seller, user_id: ids.staff, role: "staff", active: true }, { seller_id: ids.otherSeller, user_id: ids.other, role: "admin", active: true }] });
});
after(async () => {
  await prisma.seller_permissions.deleteMany({ where: { seller_id: { in: [ids.seller, ids.otherSeller] } } });
  await prisma.seller_memberships.deleteMany({ where: { seller_id: { in: [ids.seller, ids.otherSeller] } } });
  await prisma.sellers.deleteMany({ where: { id: { in: [ids.seller, ids.otherSeller] } } });
  await prisma.users.deleteMany({ where: { id: { in: [ids.owner, ids.staff, ids.other] } } });
  await prisma.$disconnect();
});

it("migrates opt-in grants and capabilities without assigning a model or seller access", async () => {
  assert.equal(await prisma.ai_capabilities.count({ where: { key: { in: ["blog_authoring", "product_authoring"] } } }), 2);
  assert.equal(await prisma.ai_capability_bindings.count({ where: { capability_key: { in: ["blog_authoring", "product_authoring"] } } }), 0);
  assert.equal(await service.canUse(actor(ids.owner), "blog"), false);
  assert.equal(await service.canUse(actor(ids.owner), "product"), false);
});

it("isolates grants, shares them with staff, and immediately observes revocation/status", async () => {
  await prisma.seller_permissions.createMany({ data: [{ seller_id: ids.seller, permission: "blog_ai" }, { seller_id: ids.otherSeller, permission: "blog_manage" }] });
  assert.equal(await service.canUse(actor(ids.owner), "blog"), false);
  assert.equal(await service.canUse(actor(ids.other), "blog"), false);
  await prisma.seller_permissions.create({ data: { seller_id: ids.seller, permission: "blog_manage" } });
  assert.equal(await service.canUse(actor(ids.owner), "blog"), true);
  assert.equal(await service.canUse(actor(ids.staff, "seller-staff"), "blog"), true);
  assert.equal(await service.canUse(actor(ids.owner), "product"), false);
  await prisma.sellers.update({ where: { id: ids.seller }, data: { suspended_at: new Date() } });
  assert.equal(await service.canUse(actor(ids.owner), "blog"), false);
  await prisma.sellers.update({ where: { id: ids.seller }, data: { suspended_at: null, approved: false } });
  assert.equal(await service.canUse(actor(ids.owner), "blog"), false);
  await prisma.sellers.update({ where: { id: ids.seller }, data: { approved: true, invited: true } });
  assert.equal(await service.canUse(actor(ids.owner), "blog"), false);
  await prisma.sellers.update({ where: { id: ids.seller }, data: { invited: false } });
  await prisma.seller_memberships.updateMany({ where: { user_id: ids.staff }, data: { active: false } });
  assert.equal(await service.canUse(actor(ids.staff, "seller-staff"), "blog"), false);
  await prisma.seller_permissions.deleteMany({ where: { seller_id: ids.seller, permission: "blog_ai" } });
  assert.equal(await service.canUse(actor(ids.owner), "blog"), false);
});

it("charges every provider request against atomic user/IP AI buckets and expires them", async () => {
  const userId = `authoring-${randomUUID()}`;
  const results = await Promise.allSettled(Array.from({ length: 21 }, () => limits.consumeAiRun(userId, "198.51.100.20")));
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 20);
  assert.equal(results.filter((result) => result.status === "rejected").length, 1);
  await limits.consumeAiRun(`other-${userId}`, "198.51.100.20");
  await assert.rejects(limits.consumeAiRun(userId, "198.51.100.21"));
  const buckets = await prisma.auth_rate_limits.findMany({ where: { action: "ai_run" } });
  assert.ok(buckets.length >= 4);
  assert.ok(buckets.every((bucket) => /^[a-f0-9]{64}$/.test(bucket.key_hash)));
  assert.ok(!JSON.stringify(buckets).includes(userId));
  await prisma.auth_rate_limits.updateMany({ where: { action: "ai_run" }, data: { window_started_at: new Date(0), blocked_until: new Date(0) } });
  await limits.consumeAiRun(userId, "198.51.100.20");
  await prisma.auth_rate_limits.deleteMany({ where: { action: "ai_run" } });
  const sharedIp = await Promise.allSettled(Array.from({ length: 61 }, (_, index) => limits.consumeAiRun(`${userId}-${index}`, "198.51.100.22")));
  assert.equal(sharedIp.filter((result) => result.status === "fulfilled").length, 60);
  assert.equal(sharedIp.filter((result) => result.status === "rejected").length, 1);
  await limits.consumeAiRun(`independent-${userId}`, "198.51.100.23");
  await prisma.auth_rate_limits.deleteMany({ where: { action: "ai_run" } });
});
