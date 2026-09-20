import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { BasePaymentAdapter } from "./base-payment.adapter";
import { PaymentService } from "./payment.service";

function adapter(code: "zarinpal" | "local-country-gateway", available: boolean) {
  return {
    providerCode: code,
    displayName: code === "zarinpal" ? "Zarinpal" : "Local test gateway",
    supportedCurrencies: ["TOMAN"],
    supportsRefunds: true,
    availability: async () => ({
      available,
      unavailabilityReason: available ? null : "development_only" as const,
      configuration: null
    }),
    paymentUrl: (reference: string) => `/pay/${reference}`,
    initiate: async () => ({ providerReferenceId: "reference", status: "pending" as const }),
    verify: async () => ({ verified: true }),
    refund: async () => ({ providerRefundId: "refund-reference" })
  } as BasePaymentAdapter;
}

describe("PaymentService", () => {
  it("resolves payment behavior and admin metadata from the same adapter registry", async () => {
    const local = adapter("local-country-gateway", false);
    const zarinpal = adapter("zarinpal", true);
    const service = new PaymentService(local, zarinpal);

    assert.equal(service.get("zarinpal"), zarinpal);
    assert.deepEqual(await service.listProviders(), [
      {
        code: "local-country-gateway",
        name: "Local test gateway",
        available: false,
        unavailabilityReason: "development_only",
        currencies: ["TOMAN"],
        supportsRefunds: true,
        configuration: null
      },
      {
        code: "zarinpal",
        name: "Zarinpal",
        available: true,
        unavailabilityReason: null,
        currencies: ["TOMAN"],
        supportsRefunds: true,
        configuration: null
      }
    ]);
    assert.deepEqual(await service.initiateWithProvider("zarinpal", {
      operationId: "operation-id",
      orderId: "order-id",
      sellerId: "seller-id",
      buyerId: "buyer-id",
      amount: "120000",
      currency: "TOMAN"
    }), { providerReferenceId: "reference", status: "pending" });
  });
});
