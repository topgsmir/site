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
});
