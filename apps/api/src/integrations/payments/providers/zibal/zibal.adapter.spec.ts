import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { ZibalAdapter } from "./zibal.adapter";

const originalFetch = globalThis.fetch;
afterEach(() => { globalThis.fetch = originalFetch; });

const credentials = {
  zibal: async () => ({
    merchantId: "merchant-12345678",
    callbackUrl: "https://api.example.com/payments/zibal/callback"
  }),
  availability: async () => ({
    reason: null,
    configuration: {
      merchantIdConfigured: true, merchantIdHint: "5678", callbackUrlConfigured: true,
      refundAccessTokenConfigured: false, refundAccessTokenHint: null
    }
  })
};

describe("Zibal payment adapter", () => {
  it("requests an exact rial amount and verifies the provider amount", async () => {
    const calls: Array<{ url: string; body: Record<string, unknown> }> = [];
    globalThis.fetch = async (url, options) => {
      const body = JSON.parse(String(options?.body)) as Record<string, unknown>;
      calls.push({ url: String(url), body });
      return new Response(JSON.stringify(calls.length === 1
        ? { result: 100, trackId: 1234567890123 }
        : { result: 100, amount: 12345, refNumber: 998877 }), { status: 200 });
    };
    const adapter = new ZibalAdapter(credentials as never);
    const initiated = await adapter.initiate({
      operationId: "operation-id", orderId: "order-id", sellerId: "seller-id", buyerId: "buyer-id",
      amount: "1234.5", currency: "TOMAN"
    });
    assert.equal(initiated.providerReferenceId, "1234567890123");
    assert.equal(initiated.paymentUrl, "https://gateway.zibal.ir/start/1234567890123");
    assert.deepEqual(await adapter.verify("1234567890123", "1234.5"), { verified: true, referenceId: "998877" });
    assert.deepEqual(calls, [
      {
        url: "https://gateway.zibal.ir/v1/request",
        body: {
          merchant: "merchant-12345678", amount: 12345,
          callbackUrl: "https://api.example.com/payments/zibal/callback",
          orderId: "operation-id", description: "TopGSM order order-id"
        }
      },
      {
        url: "https://gateway.zibal.ir/v1/verify",
        body: { merchant: "merchant-12345678", trackId: 1234567890123 }
      }
    ]);
  });

  it("keeps a successful but mismatched or already verified payment unsettled", async () => {
    const adapter = new ZibalAdapter(credentials as never);
    globalThis.fetch = async () => new Response(JSON.stringify({ result: 100, amount: 9999 }), { status: 200 });
    await assert.rejects(() => adapter.verify("1234567890123", "1000"), /different payment amount/);
    globalThis.fetch = async () => new Response(JSON.stringify({ result: 201, amount: 10000 }), { status: 200 });
    await assert.rejects(() => adapter.verify("1234567890123", "1000"), /inquiry was not successful/);
  });

  it("rejects inexact amounts and malformed provider responses", async () => {
    const adapter = new ZibalAdapter(credentials as never);
    await assert.rejects(() => adapter.initiate({ amount: "1.23", currency: "TOMAN" } as never));
    await assert.rejects(() => adapter.initiate({ amount: "1000", currency: "USD" } as never));
    globalThis.fetch = async () => new Response(JSON.stringify({ result: 100, trackId: "../other" }), { status: 200 });
    await assert.rejects(() => adapter.initiate({ amount: "1000", currency: "TOMAN", orderId: "order", operationId: "operation" } as never));
    assert.equal(adapter.paymentUrl("../other"), undefined);
    assert.equal((await adapter.availability()).available, true);
    assert.equal(adapter.supportsRefunds, false);
  });
});

for (const [status, expected] of [[1, true], [2, true], [3, false], [15, false], [18, false], [-1, null], [-2, null], [4, null], [16, null], [999, null]] as const) {
  it(`classifies Zibal payment status ${status} without treating inquiry success as payment success`, async () => {
    globalThis.fetch = async () => new Response(JSON.stringify({ result: 100, status, amount: 10000 }));
    assert.equal(await new ZibalAdapter(credentials as never).inquiry("12345", "1000"), expected);
  });
}
it("recovers an already-verified Zibal payment only with matching inquiry amount and status", async () => {
  globalThis.fetch = async (url) => new Response(JSON.stringify(String(url).endsWith("/verify")
    ? { result: 201 } : { result: 100, status: 1, amount: 10000, refNumber: 123 }));
  assert.deepEqual(await new ZibalAdapter(credentials as never).verify("12345", "1000"), { verified: true, referenceId: "123" });
  await assert.rejects(() => new ZibalAdapter(credentials as never).verify("12345", "2000"), /different payment amount/);
});
