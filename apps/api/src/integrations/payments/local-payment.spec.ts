import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { AppUser } from "@topgsm/shared-types";
import type { PrismaService } from "../../prisma/prisma.service";
import { PaymentApplicationService } from "./payment-application.service";
import type { PaymentService } from "./payment.service";
import type { PaymentCredentialService } from "./payment-credential.service";

const authority = "local-64c7ddf1-b330-4bf4-8df4-b808aa2c6b72";
const buyer = { id: "buyer-id", role: "buyer" } as AppUser;

function setup(status = "pending") {
  let query: unknown;
  let mutation: unknown;
  const prisma = {
    payment_attempts: {
      findFirst: async (input: unknown) => {
        query = input;
        return { status, amount: { toString: () => "120000" }, currency: "TOMAN", order_id: "order-id", checkout_payment_group: { checkout_id: "checkout-id", expires_at: new Date(Date.now() + 60000) } };
      },
      updateMany: async (input: unknown) => { mutation = input; return { count: 1 }; }
    }
  } as unknown as PrismaService;
  const payments = { get: () => ({ availability: async () => ({ available: true }) }) } as unknown as PaymentService;
  const service = new PaymentApplicationService(prisma, payments, {} as PaymentCredentialService);
  return { service, getQuery: () => query, getMutation: () => mutation };
}

describe("local test payment", () => {
  it("scopes the payment lookup to the authenticated buyer", async () => {
    const { service, getQuery } = setup();
    const result = await service.localPayment(buyer, authority);
    assert.equal(result.amount, "120000");
    assert.deepEqual((getQuery() as { where: unknown }).where, { provider: "local-country-gateway", authority, order: { buyer_id: "buyer-id" } });
  });

  it("cancels only a pending local attempt owned by the buyer", async () => {
    const { service, getMutation } = setup();
    const result = await service.completeLocalPayment(buyer, authority, "canceled");
    assert.equal(result.status, "failed");
    assert.deepEqual(getMutation(), { where: { provider: "local-country-gateway", authority, status: "pending", order: { buyer_id: "buyer-id" } }, data: { status: "failed", failure_code: "BUYER_CANCELLED" } });
  });

  it("rejects a second result and malformed authority", async () => {
    const { service } = setup("failed");
    await assert.rejects(() => service.completeLocalPayment(buyer, authority, "paid"), /no longer pending/);
    await assert.rejects(() => service.localPayment(buyer, "local-anything"), /authority is invalid/);
  });

  it("settles paid results through the existing callback transaction", async () => {
    const { service } = setup();
    let args: unknown[] = [];
    service.callback = async (...input) => { args = input; return { orderId: "order-id", authority, referenceId: authority, status: "succeeded", paymentUrl: undefined }; };
    const result = await service.completeLocalPayment(buyer, authority, "paid");
    assert.equal(result.status, "succeeded");
    assert.deepEqual(args, ["local-country-gateway", authority, "OK"]);
  });
});
