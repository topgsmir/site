import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { PrismaService } from "../../prisma/prisma.service";
import type { SellerShippingProfileService } from "./seller-shipping-profile.service";
import type { ShippingProvider } from "./shipping-provider";
import type { ShippingProviderRegistry } from "./shipping-provider.registry";
import { ShippingTenantService } from "./shipping-tenant.service";

describe("ShippingTenantService provisioning", () => {
  it("persists generic provider state once and reuses the ready tenant", async () => {
    let row: Record<string, unknown> | null = null;
    let provisions = 0;
    const table = {
      findUnique: async () => row,
      upsert: async ({ create, update }: { create: Record<string, unknown>; update: Record<string, unknown> }) => {
        const now = new Date();
        row = row
          ? { ...row, ...update, attempt_count: Number(row.attempt_count) + 1, updated_at: now }
          : { ...create, profile_hash: null, account_reference: null, state: {}, last_error_code: null, provisioned_at: null, created_at: now, updated_at: now };
        return row;
      },
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
        if (!row || row.claim_token !== where.claim_token || row.status !== where.status) return { count: 0 };
        row = { ...row, ...data, updated_at: new Date() };
        return { count: 1 };
      }
    };
    const prisma = {
      shipping_provider_tenants: { updateMany: table.updateMany },
      $transaction: async (callback: (tx: { shipping_provider_tenants: typeof table }) => unknown) => callback({ shipping_provider_tenants: table })
    } as unknown as PrismaService;
    const provider = {
      code: "test-provider",
      displayName: "Test Provider",
      credentialFingerprint: async () => "a".repeat(64),
      isTenantReady: (state: Record<string, unknown>) => state.accountId === "account-1",
      provisionTenant: async (input: { checkpoint: (state: { accountId: string }, accountReference: string) => Promise<void> }) => {
        provisions += 1;
        const state = { accountId: "account-1" };
        await input.checkpoint(state, "account-1");
        return { state, accountReference: "account-1" };
      }
    } as unknown as ShippingProvider;
    const profiles = { effectiveSender: async () => ({
      shopName: "Seller Shop", senderName: "Seller Sender", senderMobile: "09120000000",
      province: "تهران", city: "تهران", addressLine: "Address", postalCode: "1234567890",
      latitude: 35.6892, longitude: 51.389
    }) } as unknown as SellerShippingProfileService;
    const providers = { active: () => provider, get: () => provider } as unknown as ShippingProviderRegistry;
    const service = new ShippingTenantService(prisma, profiles, providers);

    const first = await service.effectiveForSeller("11111111-1111-4111-8111-111111111111");
    const second = await service.effectiveForSeller("11111111-1111-4111-8111-111111111111");

    assert.deepEqual(first.tenantState, { accountId: "account-1" });
    assert.deepEqual(second.tenantState, first.tenantState);
    assert.equal(provisions, 1);
    const finalRow = row as unknown as Record<string, unknown>;
    assert.equal(finalRow.status, "ready");
    assert.equal(finalRow.claim_token, null);
  });
});
