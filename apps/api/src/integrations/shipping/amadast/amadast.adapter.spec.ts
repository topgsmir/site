import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { SafeHttpService } from "../../../common/http/safe-http.service";
import { AmadastAdapter, normalizePlaceName } from "./amadast.adapter";

const config = { clientCode: "client-secret", userId: 12, storeId: 34, productType: 1, packageType: 1 };

describe("Amadast provider contract", () => {
  it("normalizes Persian and Arabic place-name variants", () => {
    assert.equal(normalizePlaceName(" استان تهران "), "تهران");
    assert.equal(normalizePlaceName("شهر كيش"), "کیش");
  });

  it("authenticates, resolves the city, and creates an order", async () => {
    const calls: Array<{ path: string; init: RequestInit }> = [];
    const http = { request: async (_base: string, path: string, init: RequestInit) => {
      calls.push({ path, init });
      if (path.startsWith("/v1/auth/token/")) return { data: { access_token: "access-token" } };
      if (path === "/v1/cities") return { data: [{ id: 8, title: "تهران" }] };
      if (path === "/v1/cities?province_id=8") return { data: [{ id: 360, title: "تهران" }] };
      if (path === "/v1/orders") return { data: { id: 554 } };
      throw new Error(`Unexpected path ${path}`);
    } } as SafeHttpService;
    const adapter = new AmadastAdapter(http);
    const result = await adapter.createOrder(config, "استان تهران", "تهران", {
      store_id: 34, external_order_id: 91, recipient_name: "گیرنده", sender_name: "فروشگاه",
      recipient_mobile: "09120000000", sender_mobile: "09121111111", recipient_address: "نشانی کامل",
      weight: 500, value: 250000, product_type: 1, package_type: 1, recipient_postal_code: "1111111111",
      is_breakable: false, is_liquid: false, is_big: false
    });
    assert.equal(result.providerOrderId, 554);
    const orderCall = calls.at(-1)!;
    assert.equal((orderCall.init.headers as Record<string, string>).Authorization, "Bearer access-token");
    assert.equal(JSON.parse(String(orderCall.init.body)).recipient_city_id, 360);
  });

  it("matches tracking by the durable external order id", async () => {
    const http = { request: async (_base: string, path: string) => path.startsWith("/v1/auth/token/")
      ? { data: { access_token: "token" } }
      : { data: [{ external_order_id: 91, amadast_tracking_code: "AM-91", courier_tracking_code: "POST-91", courier_title: "پست پیشتاز" }] }
    } as unknown as SafeHttpService;
    const tracking = await new AmadastAdapter(http).findTracking(config, "09120000000", 91);
    assert.equal(tracking?.courierTrackingCode, "POST-91");
  });

  it("fetches the documented province and city catalog", async () => {
    const calls: string[] = [];
    const http = { request: async (_base: string, path: string) => {
      calls.push(path);
      if (path === "/v1/auth/token/12") return { data: { access_token: "token" } };
      if (path === "/v1/cities") return { data: [{ id: 8, title: "تهران", parent: null }] };
      if (path === "/v1/cities?province_id=8") return { data: [{ id: 360, title: "تهران", parent: 8 }] };
      throw new Error(`Unexpected path ${path}`);
    } } as unknown as SafeHttpService;
    const adapter = new AmadastAdapter(http);

    assert.deepEqual(await adapter.listPlaces(config), [{ id: 8, title: "تهران", parentId: null }]);
    assert.deepEqual(await adapter.listPlaces(config, 8), [{ id: 360, title: "تهران", parentId: 8 }]);
    assert.deepEqual(calls, ["/v1/auth/token/12", "/v1/cities", "/v1/auth/token/12", "/v1/cities?province_id=8"]);
  });

  it("creates the documented user, location, and store resources", async () => {
    const calls: Array<{ path: string; init: RequestInit }> = [];
    const http = { request: async (_base: string, path: string, init: RequestInit) => {
      calls.push({ path, init });
      if (path === "/v1/users") return { data: { id: 11 } };
      if (path === "/v1/auth/token/11") return { data: { access_token: "tenant-token" } };
      if (path === "/v1/cities") return { data: [{ id: 8, title: "تهران" }] };
      if (path === "/v1/cities?province_id=8") return { data: [{ id: 360, title: "تهران" }] };
      if (path === "/v1/locations") return { data: { id: 22 } };
      if (path === "/v1/stores") return { data: { id: 33 } };
      throw new Error(`Unexpected path ${path}`);
    } } as SafeHttpService;
    const adapter = new AmadastAdapter(http);

    const userId = await adapter.createUser(config.clientCode, "فروشنده", "09120000000");
    const locationId = await adapter.createLocation({ clientCode: config.clientCode, userId }, {
      title: "TopGSM-tenant", address: "نشانی مبدأ", province: "تهران", city: "تهران",
      postalCode: "1234567890", latitude: 35.6892, longitude: 51.389
    });
    const storeId = await adapter.createStore({ clientCode: config.clientCode, userId }, {
      title: "فروشگاه", locationId, adminName: "فروشنده", phone: "09120000000"
    });

    assert.deepEqual({ userId, locationId, storeId }, { userId: 11, locationId: 22, storeId: 33 });
    assert.equal(JSON.parse(String(calls.find((call) => call.path === "/v1/locations")?.init.body)).province_id, 8);
    assert.equal(JSON.parse(String(calls.find((call) => call.path === "/v1/stores")?.init.body)).location_id, 22);
  });
});
