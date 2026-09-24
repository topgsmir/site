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

it("uses configurable policies for every newly covered authenticated operation", async () => {
  const statements: unknown[][] = [];
  const requestedActions: string[] = [];
  const prisma = {
    $queryRaw: async (statement: Prisma.Sql) => {
      statements.push(statement.values);
      return [{ attempt_count: 1, blocked_until: null }];
    },
    auth_rate_limits: { deleteMany: async () => ({ count: 0 }) }
  } as unknown as PrismaService;
  const policies = {
    get: async (action: string) => {
      requestedActions.push(action);
      return { ipLimit: 17, subjectLimit: 7, ipWindowSeconds: 600, subjectWindowSeconds: 1200 };
    }
  } as unknown as SecurityPolicyService;
  const limits = new AuthRateLimitService(prisma, policies);
  const operations = [
    ["profile", () => limits.consumeProfileMutation("user", "127.0.0.1")],
    ["admin_user", () => limits.consumeAdminUserOperation("user", "127.0.0.1")],
    ["blog", () => limits.consumeBlogMutation("user", "127.0.0.1")],
    ["coupon", () => limits.consumeCouponMutation("user", "127.0.0.1")],
    ["digital_download", () => limits.consumeDigitalDownload("user", "127.0.0.1")],
    ["notice_configuration", () => limits.consumeNoticeConfiguration("user", "127.0.0.1")],
    ["product", () => limits.consumeProductMutation("user", "127.0.0.1")],
    ["seller", () => limits.consumeSellerOperation("user", "127.0.0.1")],
    ["staff_admin", () => limits.consumeStaffAdmin("user", "127.0.0.1")],
    ["usd_configuration", () => limits.consumeUsdConfiguration("user", "127.0.0.1")]
  ] as const;

  for (const [, consume] of operations) await consume();

  assert.deepEqual(requestedActions, operations.map(([action]) => action));
  assert.equal(statements.length, operations.length * 2);
  for (const statement of statements) {
    assert.ok(statement.includes(17) || statement.includes(7));
    assert.ok(statement.includes(600) || statement.includes(1200));
  }
});
