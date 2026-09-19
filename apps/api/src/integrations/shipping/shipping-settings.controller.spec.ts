import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { AuthRateLimitService } from "../../modules/auth/auth-rate-limit.service";
import type { AuthenticatedRequest } from "../../modules/auth/platform-admin.guard";
import type { AmadastSettingsService } from "./amadast/amadast-settings.service";
import type { SellerShippingProfileService } from "./seller-shipping-profile.service";
import { ShippingSettingsController } from "./shipping-settings.controller";

describe("ShippingSettingsController", () => {
  it("rate-limits a credential update before persisting it", async () => {
    const calls: string[] = [];
    const settings = { update: async () => { calls.push("update"); return {} as never; } } as unknown as AmadastSettingsService;
    const rateLimits = { consumeShippingConfiguration: async (userId: string, ip: string) => { calls.push(`limit:${userId}:${ip}`); } } as AuthRateLimitService;
    const controller = new ShippingSettingsController(settings, {} as SellerShippingProfileService, rateLimits);
    await controller.update(
      { authenticatedUser: { id: "admin-id" } } as AuthenticatedRequest,
      "203.0.113.10",
      { enabled: true, clientCode: "client-code", userId: 1, storeId: 2, productType: 1, packageType: 1 }
    );
    assert.deepEqual(calls, ["limit:admin-id:203.0.113.10", "update"]);
  });
});
