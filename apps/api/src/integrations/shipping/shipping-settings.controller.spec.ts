import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { AuthRateLimitService } from "../../modules/auth/auth-rate-limit.service";
import type { AuthenticatedRequest } from "../../modules/auth/platform-admin.guard";
import type { SellerShippingProfileService } from "./seller-shipping-profile.service";
import { ShippingSettingsController } from "./shipping-settings.controller";
import type { ShippingProviderRegistry } from "./shipping-provider.registry";
import type { ShippingTenantService } from "./shipping-tenant.service";

describe("ShippingSettingsController", () => {
  it("rate-limits a credential update before persisting it", async () => {
    const calls: string[] = [];
    const providers = { active: () => ({ configureApiKey: async () => { calls.push("update"); return {} as never; } }) } as unknown as ShippingProviderRegistry;
    const rateLimits = { consumeShippingConfiguration: async (userId: string, ip: string) => { calls.push(`limit:${userId}:${ip}`); } } as AuthRateLimitService;
    const controller = new ShippingSettingsController(providers, {} as SellerShippingProfileService, {} as ShippingTenantService, rateLimits);
    await controller.update(
      { authenticatedUser: { id: "admin-id" } } as AuthenticatedRequest,
      "203.0.113.10",
      { apiKey: "client-code" }
    );
    assert.deepEqual(calls, ["limit:admin-id:203.0.113.10", "update"]);
  });

  it("authorizes the seller and rate-limits before calling the provider place catalog", async () => {
    const calls: string[] = [];
    const profiles = { assertAdminCanConfigure: async (sellerId: string) => { calls.push(`seller:${sellerId}`); } } as SellerShippingProfileService;
    const tenants = { listPlacesForSeller: async () => { calls.push("places"); return []; } } as unknown as ShippingTenantService;
    const rateLimits = { consumeShippingConfiguration: async () => { calls.push("limit"); } } as unknown as AuthRateLimitService;
    const controller = new ShippingSettingsController({} as ShippingProviderRegistry, profiles, tenants, rateLimits);
    const sellerId = "11111111-1111-4111-8111-111111111111";

    await controller.places(
      { authenticatedUser: { id: "admin-id" } } as AuthenticatedRequest,
      "203.0.113.10",
      sellerId,
      { senderName: "Seller", senderMobile: "09120000000" }
    );

    assert.deepEqual(calls, ["limit", `seller:${sellerId}`, "places"]);
  });
});
