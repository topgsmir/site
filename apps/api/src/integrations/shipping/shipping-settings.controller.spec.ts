import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { AuthRateLimitService } from "../../modules/auth/auth-rate-limit.service";
import type { AuthenticatedRequest } from "../../modules/auth/platform-admin.guard";
import type { SellerShippingProfileService } from "./seller-shipping-profile.service";
import { ShippingSettingsController } from "./shipping-settings.controller";
import type { ShippingProviderRegistry } from "./shipping-provider.registry";
import type { ShippingTenantService } from "./shipping-tenant.service";
import type { ShippingPolicyService } from "./shipping-policy.service";

describe("ShippingSettingsController", () => {
  it("rate-limits policy changes before saving with the verified admin", async () => {
    const calls: string[] = [];
    const policy = { update: async (_body: unknown, userId: string) => { calls.push(`save:${userId}`); return {} as never; } } as unknown as ShippingPolicyService;
    const rateLimits = { consumeShippingConfiguration: async () => { calls.push("limit"); } } as unknown as AuthRateLimitService;
    const controller = new ShippingSettingsController({} as ShippingProviderRegistry, {} as SellerShippingProfileService, {} as ShippingTenantService, rateLimits, policy);
    await controller.updatePolicy({ authenticatedUser: { id: "admin-id" } } as AuthenticatedRequest, "203.0.113.10", {} as never);
    assert.deepEqual(calls, ["limit", "save:admin-id"]);
  });

  it("rate-limits a credential update before persisting it", async () => {
    const calls: string[] = [];
    const providers = { active: () => ({ configureApiKey: async () => { calls.push("update"); return {} as never; } }) } as unknown as ShippingProviderRegistry;
    const rateLimits = { consumeShippingConfiguration: async (userId: string, ip: string) => { calls.push(`limit:${userId}:${ip}`); } } as AuthRateLimitService;
    const controller = new ShippingSettingsController(providers, {} as SellerShippingProfileService, {} as ShippingTenantService, rateLimits, {} as ShippingPolicyService);
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
    const controller = new ShippingSettingsController({} as ShippingProviderRegistry, profiles, tenants, rateLimits, {} as ShippingPolicyService);
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
