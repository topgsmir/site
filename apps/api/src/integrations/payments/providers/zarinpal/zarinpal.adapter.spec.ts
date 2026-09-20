import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { ZarinpalAdapter } from "./zarinpal.adapter";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

describe("Zarinpal toman boundary", () => {
  it("sends rial amounts to the provider while accepting toman internally", async () => {
    const amounts: number[] = [];
    globalThis.fetch = async (_url, options) => {
      const body = JSON.parse(String(options?.body)) as { amount?: number };
      if (body.amount !== undefined) amounts.push(body.amount);
      return new Response(JSON.stringify({ data: { code: 100, authority: "authority" } }), { status: 200 });
    };
    const adapter = new ZarinpalAdapter({ zarinpal: async () => ({ merchantId: "merchant", callbackUrl: "https://example.test/callback" }) } as never);

    await adapter.initiate({ amount: "1234", currency: "TOMAN", orderId: "order", operationId: "operation" } as never);
    await adapter.verify("authority", "12.3");

    assert.deepEqual(amounts, [12340, 123]);
  });

  it("rejects values that cannot be sent exactly as integer rials", async () => {
    const adapter = new ZarinpalAdapter({ zarinpal: async () => ({ merchantId: "merchant", callbackUrl: "https://example.test/callback" }) } as never);
    await assert.rejects(() => adapter.initiate({ amount: "1.23", currency: "TOMAN", orderId: "order", operationId: "operation" } as never));
    await assert.rejects(() => adapter.initiate({ amount: "1", currency: "USD", orderId: "order", operationId: "operation" } as never));
  });
});
