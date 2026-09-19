import { strict as assert } from "node:assert";
import { after, before, describe, it } from "node:test";
import { createHash, randomUUID } from "node:crypto";
import { AuthRateLimitService } from "./auth-rate-limit.service";
import { SecurityPolicyService } from "./security-policy.service";
import { AuthService } from "./auth.service";
import { AuthLoginSettingsService } from "./auth-login-settings.service";
import { PrismaService } from "../../prisma/prisma.service";
import { assertDedicatedTestDatabase } from "../../test/test-database";

assertDedicatedTestDatabase();
const prisma = new PrismaService();
const auth = new AuthService(prisma, new AuthLoginSettingsService(prisma));
const rateLimits = new AuthRateLimitService(prisma, new SecurityPolicyService(prisma));
const suffix = randomUUID();
const email = `security-${suffix}@example.com`;
const ip = `test-${suffix}`;
const concurrentEmail = `concurrent-${suffix}@example.com`;
const concurrentIp = `concurrent-${suffix}`;
const rateUser = `rate-user-${suffix}`;
const rateIp = `rate-ip-${suffix}`;
const ratePhone = `+989${suffix.replaceAll("-", "").slice(0, 9)}`;
const rateAuthority = `authority-${suffix}`;
const rateToken = `token-${suffix}`;
const aiTestUser = `ai-test-user-${suffix}`;
const aiTestIp = `ai-test-ip-${suffix}`;

before(async () => {
  await prisma.$connect();
});

after(async () => {
  const keyHashes = [
    `login:account:${email.toLowerCase()}`,
    `login:ip:${ip.toLowerCase()}`,
    `login:account:${concurrentEmail.toLowerCase()}`,
    `login:ip:${concurrentIp.toLowerCase()}`,
    `media:account:${rateUser}`,
    `media:ip:${rateIp}`,
    `otp:phone:${ratePhone}`,
    `otp:ip:${rateIp}`,
    `payment:account:${rateUser}`,
    `payment:ip:${rateIp}`,
    `payment_callback:authority:${rateAuthority}`,
    `payment_callback:ip:${rateIp}`,
    `payment_refund:account:${rateUser}`,
    `payment_refund:ip:${rateIp}`,
    `payment_configuration:account:${rateUser}`,
    `payment_configuration:ip:${rateIp}`,
    `sms_configuration:account:${rateUser}`,
    `sms_configuration:ip:${rateIp}`,
    `staff_setup:token:${rateToken}`,
    `staff_setup:ip:${rateIp}`,
    `bridge:account:${rateUser}`,
    `bridge:ip:${rateIp}`,
    `signed_ticket:account:${rateUser}`,
    `signed_ticket:ip:${rateIp}`,
    `ai_profile_test:account:${rateUser}`,
    `ai_profile_test:ip:${rateIp}`,
    `ai_profile_test:account:${aiTestUser}`,
    `ai_profile_test:ip:${aiTestIp}`,
    `product_bulk_undo:account:${rateUser}`,
    `product_bulk_undo:ip:${rateIp}`
  ].map((value) => createHash("sha256").update(value).digest("hex"));
  await prisma.auth_rate_limits.deleteMany({
    where: { key_hash: { in: keyHashes } }
  });
  await prisma.users.deleteMany({ where: { email } });
  await prisma.$disconnect();
});

describe("database-backed authentication", () => {
  it("stores only a token hash and enforces revocation", async () => {
    const session = await auth.register({
      fullName: "Security Test",
      email,
      password: "correct horse battery staple"
    });
    assert.match(session.token, /^[A-Za-z0-9_-]{43}$/);

    const stored = await prisma.auth_sessions.findFirstOrThrow({
      where: { user_id: session.user.id },
      select: { token_hash: true }
    });
    assert.notEqual(stored.token_hash, session.token);
    assert.equal(
      stored.token_hash,
      createHash("sha256").update(session.token).digest("hex")
    );
    assert.equal((await auth.getUserFromToken(session.token)).id, session.user.id);

    await auth.revokeSession(session.token);
    await assert.rejects(
      () => auth.getUserFromToken(session.token),
      /Session is no longer valid/
    );
  });

  it("atomically blocks login attempts after the configured account limit", async () => {
    for (let attempt = 0; attempt < 8; attempt += 1) {
      await rateLimits.consumeLogin(email, ip);
    }
    await assert.rejects(
      () => rateLimits.consumeLogin(email, ip),
      (error: unknown) =>
        typeof error === "object" &&
        error !== null &&
        "status" in error &&
        error.status === 429
    );

    const buckets = await prisma.auth_rate_limits.findMany({
      where: { action: "login" },
      select: { key_hash: true }
    });
    assert.ok(buckets.length >= 2);
    assert.ok(buckets.every((bucket) => /^[0-9a-f]{64}$/.test(bucket.key_hash)));
    assert.ok(buckets.every((bucket) => !bucket.key_hash.includes(email)));
  });

  it("enforces the account limit under concurrent requests", async () => {
    const results = await Promise.allSettled(
      Array.from({ length: 12 }, () =>
        rateLimits.consumeLogin(concurrentEmail, concurrentIp)
      )
    );
    const rejected = results.filter((result) => result.status === "rejected");
    assert.ok(rejected.length >= 4);
    assert.ok(
      rejected.every(
        (result) =>
          result.status === "rejected" &&
          typeof result.reason === "object" &&
          result.reason !== null &&
          "status" in result.reason &&
          result.reason.status === 429
      )
    );
  });

  it("persists every abuse-sensitive rate-limit action", async () => {
    await rateLimits.consumeMediaUpload(rateUser, rateIp);
    await rateLimits.consumeOtp(ratePhone, rateIp);
    await rateLimits.consumePaymentInitiation(rateUser, rateIp);
    await rateLimits.consumePaymentCallback(rateAuthority, rateIp);
    await rateLimits.consumePaymentRefund(rateUser, rateIp);
    await rateLimits.consumePaymentConfiguration(rateUser, rateIp);
    await rateLimits.consumeSmsConfiguration(rateUser, rateIp);
    await rateLimits.consumeStaffSetup(rateToken, rateIp);
    await rateLimits.consumeBridgeOperation(rateUser, rateIp);
    await rateLimits.consumeSignedTicket(rateUser, rateIp);
    await rateLimits.consumeAiProfileTest(rateUser, rateIp);
    await rateLimits.consumeProductBulkUndo(rateUser, rateIp);

    const rows = await prisma.auth_rate_limits.findMany({
      where: {
        action: {
          in: [
            "media",
            "otp",
            "payment",
            "payment_callback",
            "payment_refund",
            "payment_configuration",
            "sms_configuration",
            "staff_setup",
            "bridge",
            "signed_ticket",
            "ai_profile_test",
            "product_bulk_undo"
          ]
        }
      },
      select: { action: true }
    });
    const actions = new Set(rows.map((row) => row.action));
    for (const action of [
      "media",
      "otp",
      "payment",
      "payment_callback",
      "payment_refund",
      "payment_configuration",
      "sms_configuration",
      "staff_setup",
      "bridge",
      "signed_ticket",
      "ai_profile_test",
      "product_bulk_undo"
    ]) {
      assert.ok(actions.has(action), `missing ${action} rate-limit bucket`);
    }
  });

  it("allows 30 AI model connection tests per admin account window", async () => {
    for (let attempt = 0; attempt < 30; attempt += 1) {
      await rateLimits.consumeAiProfileTest(aiTestUser, aiTestIp);
    }

    await assert.rejects(
      () => rateLimits.consumeAiProfileTest(aiTestUser, aiTestIp),
      (error: unknown) =>
        typeof error === "object" &&
        error !== null &&
        "status" in error &&
        error.status === 429
    );
  });
});
