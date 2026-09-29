import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { PrismaService } from "../../prisma/prisma.service";
import type { UpdateShippingPolicyDto } from "./dto/shipping-policy.dto";
import { ShippingPolicyService } from "./shipping-policy.service";

const rule = { payer: "customer" as const, flatRateToman: "300", freeAboveToman: "2000", allowedProvinces: [" Tehran "], maxWeightGrams: 1000, maxLengthCm: null, maxWidthCm: null, maxHeightCm: null };

describe("ShippingPolicyService", () => {
  it("returns a zero cost policy before configuration", async () => {
    const service = new ShippingPolicyService({ shipping_settings: { findUnique: async () => null } } as unknown as PrismaService);
    const result = await service.get();
    assert.equal(result.defaultRule.payer, "site");
    assert.equal(result.defaultRule.flatRateToman, "0");
    assert.deepEqual(result.sellerRules, []);
  });

  it("persists a normalized policy with an actor audit and rejects stale saves", async () => {
    const calls: string[] = [];
    let stored: unknown;
    const timestamp = new Date("2026-09-29T12:00:00.000Z");
    const db = {
      sellers: { findMany: async () => [] },
      $transaction: async (work: (tx: unknown) => Promise<unknown>) => work({
        shipping_settings: {
          findUnique: async () => ({ updated_at: timestamp }),
          upsert: async ({ update }: { update: { policy: unknown } }) => { calls.push("save"); stored = update.policy; return { provider: "amadast", enabled: false, api_key_hint: null, user_id: null, store_id: null, product_type: 1, package_type: 1, updated_at: timestamp }; }
        },
        shipping_setting_events: { create: async ({ data }: { data: { actor_user_id: string; policy: unknown } }) => { calls.push("audit"); assert.equal(data.actor_user_id, "admin-id"); assert.deepEqual(data.policy, stored); } }
      })
    } as unknown as PrismaService;
    const service = new ShippingPolicyService(db);
    const input = { defaultRule: rule, sellerRules: [], updatedAt: timestamp.toISOString() } as UpdateShippingPolicyDto;
    const saved = await service.update(input, "admin-id");
    assert.deepEqual(calls, ["save", "audit"]);
    assert.deepEqual(saved.defaultRule.allowedProvinces, ["Tehran"]);
    await assert.rejects(() => service.update({ ...input, updatedAt: null }, "admin-id"), /changed/i);
  });

  it("rejects duplicate seller overrides", async () => {
    const service = new ShippingPolicyService({} as PrismaService);
    const sellerId = "11111111-1111-4111-8111-111111111111";
    await assert.rejects(() => service.update({ defaultRule: rule, sellerRules: [{ sellerId, rule }, { sellerId, rule }], updatedAt: null }, "admin-id"), /unique/i);
  });
});
