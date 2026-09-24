import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { PrismaService } from "../../prisma/prisma.service";
import type { SellerShippingProfileService } from "./seller-shipping-profile.service";
import type { ShippingProvider } from "./shipping-provider";
import type { ShippingProviderRegistry } from "./shipping-provider.registry";
import { ShippingTenantService } from "./shipping-tenant.service";

describe("ShippingTenantService place catalog", () => {
  it("checkpoints one provider account and reuses it for province and city requests", async () => {
    let row: Record<string, unknown> | null = null;
    const calls: string[] = [];
    const tenantTable = {
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
      shipping_provider_tenants: { updateMany: tenantTable.updateMany },
      $transaction: async (callback: (tx: { shipping_provider_tenants: typeof tenantTable }) => unknown) => callback({ shipping_provider_tenants: tenantTable })
    } as unknown as PrismaService;
    const provider = {
      code: "amadast",
      displayName: "Amadast",
      credentialFingerprint: async () => "a".repeat(64),
      isTenantAccountReady: (state: Record<string, unknown>) => state.userId === 101,
      ensureTenantAccount: async ({ state, checkpoint }: { state: Record<string, unknown>; checkpoint: (state: Record<string, unknown>, reference: string) => Promise<void> }) => {
        calls.push("account:create");
        const next = { ...state, userId: 101 };
        await checkpoint(next, "101");
        return { state: next, accountReference: "101" };
      },
      listPlaces: async ({ provinceId }: { provinceId?: number }) => {
        calls.push(provinceId ? `cities:${provinceId}` : "provinces");
        return [{ id: provinceId ? 360 : 8, title: "تهران", parentId: provinceId ?? null }];
      }
    } as unknown as ShippingProvider;
    const providers = { active: () => provider } as ShippingProviderRegistry;
    const service = new ShippingTenantService(prisma, {} as SellerShippingProfileService, providers);
    const base = { sellerId: "11111111-1111-4111-8111-111111111111", senderName: "Seller", senderMobile: "09120000000" };

    assert.deepEqual(await service.listPlacesForSeller(base), [{ id: 8, title: "تهران", parentId: null }]);
    assert.deepEqual(await service.listPlacesForSeller({ ...base, provinceId: 8 }), [{ id: 360, title: "تهران", parentId: 8 }]);
    assert.deepEqual(calls, ["account:create", "provinces", "cities:8"]);
    assert.equal((row as { status?: string } | null)?.status, "pending");
  });
});
