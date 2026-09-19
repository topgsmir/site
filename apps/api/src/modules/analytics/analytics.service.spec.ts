import { BadRequestException, ForbiddenException } from "@nestjs/common";
import assert from "node:assert/strict";
import test from "node:test";
import type { AppUser } from "@topgsm/shared-types";
import type { PrismaService } from "../../prisma/prisma.service";
import { AnalyticsService } from "./analytics.service";

type TestableAnalytics = {
  normalizeRange(input: { from?: string; to?: string; timezone: "Asia/Tehran" }): { from: string; to: string; granularity: string };
  previousRange(from: string, to: string): { from: string; to: string };
  metric(value: unknown, previous: unknown): { value: string; previousValue: string; changePercent: number | null };
  resolveScope(actor: AppUser): Promise<{ scope: string; sellerId: string | null }>;
};

function serviceWithMembership(membership: { seller_id: string } | null = null) {
  const prisma = {
    seller_memberships: { findFirst: async () => membership }
  } as unknown as PrismaService;
  return new AnalyticsService(prisma) as unknown as TestableAnalytics;
}

test("normalizes supported ranges and selects stable granularities", () => {
  const service = serviceWithMembership();
  assert.equal(service.normalizeRange({ from: "2026-09-17", to: "2026-09-17", timezone: "Asia/Tehran" }).granularity, "hour");
  assert.equal(service.normalizeRange({ from: "2026-08-19", to: "2026-09-17", timezone: "Asia/Tehran" }).granularity, "day");
  assert.equal(service.normalizeRange({ from: "2026-01-01", to: "2026-09-17", timezone: "Asia/Tehran" }).granularity, "month");
});

test("rejects reversed, invalid, and overlong ranges", () => {
  const service = serviceWithMembership();
  assert.throws(() => service.normalizeRange({ from: "2026-09-18", to: "2026-09-17", timezone: "Asia/Tehran" }), BadRequestException);
  assert.throws(() => service.normalizeRange({ from: "2026-02-30", to: "2026-03-01", timezone: "Asia/Tehran" }), BadRequestException);
  assert.throws(() => service.normalizeRange({ from: "2025-01-01", to: "2026-09-17", timezone: "Asia/Tehran" }), BadRequestException);
});

test("builds an equal preceding comparison window", () => {
  const service = serviceWithMembership();
  assert.deepEqual(service.previousRange("2026-09-01", "2026-09-07"), { from: "2026-08-25", to: "2026-08-31" });
});

test("returns null comparison when the previous value is zero", () => {
  const service = serviceWithMembership();
  assert.deepEqual(service.metric("100", "0"), { value: "100", previousValue: "0", changePercent: null });
  assert.equal(service.metric("150", "100").changePercent, 50);
});

test("allows only platform owners or active analytics seller memberships", async () => {
  const admin = serviceWithMembership();
  assert.deepEqual(await admin.resolveScope({ id: "admin", fullName: "A", email: "a@example.com", role: "platform-admin" }), { scope: "admin", sellerId: null });

  const seller = serviceWithMembership({ seller_id: "seller-1" });
  assert.deepEqual(await seller.resolveScope({ id: "staff", fullName: "S", email: "s@example.com", role: "seller-staff" }), { scope: "seller", sellerId: "seller-1" });

  const denied = serviceWithMembership(null);
  await assert.rejects(() => denied.resolveScope({ id: "staff", fullName: "S", email: "s@example.com", role: "seller-staff" }), ForbiddenException);
  await assert.rejects(() => denied.resolveScope({ id: "buyer", fullName: "B", email: "b@example.com", role: "buyer" }), ForbiddenException);
});
