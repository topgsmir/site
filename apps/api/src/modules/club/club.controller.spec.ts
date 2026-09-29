import assert from "node:assert/strict";
import { test } from "node:test";
import { ForbiddenException } from "@nestjs/common";
import { GUARDS_METADATA } from "@nestjs/common/constants";
import type { AuthRateLimitService } from "../auth/auth-rate-limit.service";
import { PlatformAdminGuard, type AuthenticatedRequest } from "../auth/platform-admin.guard";
import { AuthenticatedGuard } from "../auth/authenticated.guard";
import { ClubController } from "./club.controller";
import { ClubAdminController } from "./club-admin.controller";
import type { ClubService } from "./club.service";
import type { ClubAdminService } from "./club-admin.service";

test("buyer club endpoints reject seller sessions and require authentication", () => {
  const controller = new ClubController({ summary: async () => ({ enabled: false }) } as unknown as ClubService, {} as AuthRateLimitService);
  const seller = { authenticatedUser: { id: "seller-id", role: "seller-admin" } } as unknown as AuthenticatedRequest;
  assert.throws(() => controller.summary(seller), ForbiddenException);
  assert.deepEqual(Reflect.getMetadata(GUARDS_METADATA, ClubController), [AuthenticatedGuard]);
});

test("admin club endpoints are restricted to platform administrators", () => {
  const controller = new ClubAdminController({} as ClubAdminService, {} as ClubService, {} as AuthRateLimitService);
  assert.ok(controller);
  assert.deepEqual(Reflect.getMetadata(GUARDS_METADATA, ClubAdminController), [PlatformAdminGuard]);
});
