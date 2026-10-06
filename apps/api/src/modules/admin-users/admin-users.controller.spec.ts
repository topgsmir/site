import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { AuthRateLimitService } from "../auth/auth-rate-limit.service";
import type { AuthService } from "../auth/auth.service";
import type { AuthenticatedRequest } from "../auth/platform-admin.guard";
import { AdminUsersController } from "./admin-users.controller";
import type { AdminUsersService } from "./admin-users.service";
import type { SellerStatisticsService } from "./seller-statistics.service";

describe("AdminUsersController", () => {
  it("rate-limits seller statistics before the aggregate query", async () => {
    const calls: string[] = [];
    const controller = new AdminUsersController(
      {} as AdminUsersService,
      { list: async () => { calls.push("query"); return { items: [] }; } } as unknown as SellerStatisticsService,
      { consumeAnalyticsRead: async () => { calls.push("limit"); } } as unknown as AuthRateLimitService,
      {} as AuthService
    );
    await controller.statistics({ period: "7d", page: 1, limit: 20 }, { authenticatedUser: { id: "owner-id" } } as AuthenticatedRequest, "203.0.113.10");
    assert.deepEqual(calls, ["limit", "query"]);
  });

  it("rate-limits and confirms the owner password before replacing a user password", async () => {
    const calls: string[] = [];
    const users = {
      changePassword: async (userId: string, actorId: string, password: string) => {
        calls.push(`change:${userId}:${actorId}:${password}`);
        return { sessionsRevoked: 3 };
      }
    } as unknown as AdminUsersService;
    const rateLimits = {
      consumeAdminUserOperation: async (actorId: string, ip: string) => { calls.push(`limit:${actorId}:${ip}`); }
    } as unknown as AuthRateLimitService;
    const auth = {
      verifyCurrentPassword: async (actorId: string, password: string) => { calls.push(`verify:${actorId}:${password}`); }
    } as unknown as AuthService;
    const controller = new AdminUsersController(users, {} as SellerStatisticsService, rateLimits, auth);
    const request = { authenticatedUser: { id: "owner-id" } } as AuthenticatedRequest;

    const result = await controller.changePassword(
      { id: "3dd30b78-d1dc-44e0-a420-798e474b7a0a" },
      { currentPassword: "owner-password", newPassword: "replacement-password" },
      request,
      "203.0.113.10"
    );

    assert.deepEqual(calls, [
      "limit:owner-id:203.0.113.10",
      "verify:owner-id:owner-password",
      "change:3dd30b78-d1dc-44e0-a420-798e474b7a0a:owner-id:replacement-password"
    ]);
    assert.deepEqual(result, { sessionsRevoked: 3 });
  });
});
