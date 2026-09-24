import { strict as assert } from "node:assert";
import { createHash } from "node:crypto";
import { describe, it } from "node:test";
import type { AmadastAdapter } from "./amadast.adapter";
import { AmadastShippingProvider } from "./amadast-shipping.provider";
import type { AmadastSettingsService } from "./amadast-settings.service";

const origin = {
  shopName: "Seller Shop",
  senderName: "Seller Sender",
  senderMobile: "09120000000",
  province: "تهران",
  city: "تهران",
  addressLine: "تهران، خیابان نمونه، پلاک ۱",
  postalCode: "1234567890",
  latitude: 35.6892,
  longitude: 51.389
};

describe("AmadastShippingProvider", () => {
  it("provisions provider resources and checkpoints every durable reference", async () => {
    const calls: string[] = [];
    const checkpoints: Array<Record<string, unknown>> = [];
    const settings = { effective: async () => ({ clientCode: "platform-api-key" }) } as AmadastSettingsService;
    const adapter = {
      createUser: async () => { calls.push("user:create"); return 101; },
      findLocation: async () => { calls.push("location:find"); return null; },
      createLocation: async () => { calls.push("location:create"); return 202; },
      findStore: async () => { calls.push("store:find"); return null; },
      createStore: async () => { calls.push("store:create"); return 303; }
    } as unknown as AmadastAdapter;
    const provider = new AmadastShippingProvider(settings, adapter);

    const result = await provider.provisionTenant({
      sellerId: "11111111-1111-4111-8111-111111111111",
      origin,
      state: {},
      profileChanged: false,
      checkpoint: async (state) => { checkpoints.push({ ...state }); }
    });

    const accountMobileHash = createHash("sha256").update(origin.senderMobile).digest("hex");
    assert.deepEqual(result.state, { userId: 101, accountMobileHash, locationId: 202, storeId: 303 });
    assert.equal(result.accountReference, "101");
    assert.equal(provider.isTenantReady(result.state), true);
    assert.deepEqual(calls, ["user:create", "location:find", "location:create", "store:find", "store:create"]);
    assert.deepEqual(checkpoints, [
      { userId: 101, accountMobileHash },
      { userId: 101, accountMobileHash, locationId: 202 },
      { userId: 101, accountMobileHash, locationId: 202, storeId: 303 }
    ]);
  });

  it("keeps the provider account but reprovisions origin resources after a profile change", async () => {
    const settings = { effective: async () => ({ clientCode: "platform-api-key" }) } as AmadastSettingsService;
    let createdUser = false;
    const adapter = {
      createUser: async () => { createdUser = true; return 999; },
      findLocation: async () => 404,
      createLocation: async () => { throw new Error("location should be reconciled"); },
      findStore: async () => 505,
      createStore: async () => { throw new Error("store should be reconciled"); }
    } as unknown as AmadastAdapter;

    const result = await new AmadastShippingProvider(settings, adapter).provisionTenant({
      sellerId: "22222222-2222-4222-8222-222222222222",
      origin,
      state: { userId: 101, locationId: 202, storeId: 303 },
      profileChanged: true,
      checkpoint: async () => undefined
    });

    assert.equal(createdUser, false);
    assert.deepEqual(result.state, {
      userId: 101,
      accountMobileHash: createHash("sha256").update(origin.senderMobile).digest("hex"),
      locationId: 404,
      storeId: 505
    });
  });

  it("creates a new provider account when the seller changes sender mobile", async () => {
    const settings = { effective: async () => ({ clientCode: "platform-api-key" }) } as AmadastSettingsService;
    let createdWith: string | undefined;
    const adapter = {
      createUser: async (_key: string, _name: string, mobile: string) => { createdWith = mobile; return 999; },
      findLocation: async () => 404,
      findStore: async () => 505
    } as unknown as AmadastAdapter;
    const previousHash = createHash("sha256").update(origin.senderMobile).digest("hex");

    const result = await new AmadastShippingProvider(settings, adapter).provisionTenant({
      sellerId: "33333333-3333-4333-8333-333333333333",
      origin: { ...origin, senderMobile: "09123334444" },
      state: { userId: 101, accountMobileHash: previousHash, locationId: 202, storeId: 303 },
      profileChanged: true,
      checkpoint: async () => undefined
    });

    assert.equal(createdWith, "09123334444");
    assert.equal(result.state.userId, 999);
  });

  it("uses the tenant account to fetch Amadast provinces and cities", async () => {
    const settings = { effective: async () => ({ clientCode: "platform-api-key" }) } as AmadastSettingsService;
    const adapter = {
      listPlaces: async (config: { clientCode: string; userId: number }, provinceId?: number) => [{ id: provinceId ? 360 : 8, title: "تهران", parentId: provinceId ?? null }]
    } as unknown as AmadastAdapter;
    const provider = new AmadastShippingProvider(settings, adapter);

    assert.deepEqual(await provider.listPlaces({ tenantState: { userId: 101 } }), [{ id: 8, title: "تهران", parentId: null }]);
    assert.deepEqual(await provider.listPlaces({ tenantState: { userId: 101 }, provinceId: 8 }), [{ id: 360, title: "تهران", parentId: 8 }]);
  });
});
