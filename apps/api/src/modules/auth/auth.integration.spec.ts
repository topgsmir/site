import { strict as assert } from "node:assert";
import { after, before, describe, it } from "node:test";
import { createHash, randomUUID } from "node:crypto";
import { AuthRateLimitService } from "./auth-rate-limit.service";
import { AuthService } from "./auth.service";
import { PrismaService } from "../../prisma/prisma.service";

const prisma = new PrismaService();
const auth = new AuthService(prisma);
const rateLimits = new AuthRateLimitService(prisma);
const suffix = randomUUID();
const email = `security-${suffix}@example.com`;
const ip = `test-${suffix}`;
const concurrentEmail = `concurrent-${suffix}@example.com`;
const concurrentIp = `concurrent-${suffix}`;

before(async () => {
  await prisma.$connect();
});

after(async () => {
  const keyHashes = [
    `login:account:${email.toLowerCase()}`,
    `login:ip:${ip.toLowerCase()}`,
    `login:account:${concurrentEmail.toLowerCase()}`,
    `login:ip:${concurrentIp.toLowerCase()}`
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
});
