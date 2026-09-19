import assert from "node:assert/strict";
import { it } from "node:test";
import type { Prisma } from "../../prisma/client";
import type { PrismaService } from "../../prisma/prisma.service";
import { AuthRateLimitService } from "./auth-rate-limit.service";
import type { SecurityPolicyService } from "./security-policy.service";

it("uses the configured OTP limits and windows in both atomic buckets", async () => {
  const statements: unknown[][] = [];
  const prisma = { $queryRaw: async (statement: Prisma.Sql) => {
    statements.push(statement.values);
    return [{ attempt_count: 1, blocked_until: null }];
  } } as unknown as PrismaService;
  const policies = { get: async () => ({ ipLimit: 12, subjectLimit: 2, ipWindowSeconds: 600, subjectWindowSeconds: 1800 }) } as unknown as SecurityPolicyService;
  await new AuthRateLimitService(prisma, policies).consumeOtp("09123456789", "127.0.0.1");
  assert.equal(statements.length, 2);
  assert.ok(statements[0].includes(12));
  assert.ok(statements[0].includes(600));
  assert.ok(statements[1].includes(2));
  assert.ok(statements[1].includes(1800));
});
