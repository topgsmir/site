import assert from "node:assert/strict";
import test from "node:test";
import type { AuthRateLimitService } from "../auth/auth-rate-limit.service";
import type { AuthenticatedRequest } from "../auth/platform-admin.guard";
import { AnalyticsController } from "./analytics.controller";
import type { AnalyticsService } from "./analytics.service";

test("rate-limits an analytics read before running aggregate queries", async () => {
  const calls: string[] = [];
  const analytics = {
    overview: async () => { calls.push("overview"); return {} as never; }
  } as unknown as AnalyticsService;
  const rateLimits = {
    consumeAnalyticsRead: async (userId: string, ip: string) => { calls.push(`limit:${userId}:${ip}`); }
  } as AuthRateLimitService;
  const controller = new AnalyticsController(analytics, rateLimits);

  await controller.overview(
    { authenticatedUser: { id: "admin-id" } } as AuthenticatedRequest,
    "203.0.113.10",
    { timezone: "Asia/Tehran" }
  );

  assert.deepEqual(calls, ["limit:admin-id:203.0.113.10", "overview"]);
});
