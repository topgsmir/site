import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { PrismaService } from "../../prisma/prisma.service";
import { PaymentApplicationService } from "./payment-application.service";
import type { PaymentService } from "./payment.service";
import type { PaymentCredentialService } from "./payment-credential.service";

describe("PaymentApplicationService admin transactions", () => {
  it("returns a capped cursor page with a safe payment and party projection", async () => {
    let query: Record<string, unknown> | undefined;
    const createdAt = new Date("2026-09-13T09:00:00.000Z");
    const prisma = {
      payment_attempts: {
        count: async () => 2,
        findMany: async (input: Record<string, unknown>) => {
          query = input;
          return [
            {
              id: "14b20d50-e4e2-4b99-b79d-eef84cc5667a",
              order_id: "4d29d418-f647-4525-96db-181593024341",
              provider: "zarinpal",
              status: "pending",
              amount: { toString: () => "125000" },
              currency: "TOMAN",
              authority: "A0000000001",
              provider_ref_id: null,
              failure_code: null,
              verified_at: null,
              refunded_at: null,
              created_at: createdAt,
              updated_at: createdAt,
              order: {
                buyer: { id: "buyer-id", full_name: "Buyer", email: "buyer@example.com" },
                seller: { id: "seller-id", shop_name: "Seller shop" }
              }
            },
            {
              id: "87217311-97d3-46c5-bc0d-d6ed5922a818",
              order_id: "76f0f739-c8a9-493d-918a-50705703192d",
              provider: "zarinpal",
              status: "failed",
              amount: { toString: () => "90000" },
              currency: "TOMAN",
              authority: "A0000000002",
              provider_ref_id: null,
              failure_code: "VERIFICATION_FAILED",
              verified_at: null,
              refunded_at: null,
              created_at: createdAt,
              updated_at: createdAt,
              order: {
                buyer: { id: "buyer-id-2", full_name: "Buyer Two", email: "buyer2@example.com" },
                seller: { id: "seller-id-2", shop_name: "Second shop" }
              }
            }
          ];
        }
      }
    } as unknown as PrismaService;
    const service = new PaymentApplicationService(prisma, {} as PaymentService, {} as PaymentCredentialService);

    const result = await service.listTransactions({
      limit: 1,
      cursor: "d3b59a08-80f8-4f91-a11e-90dbd1f8949a",
      status: "pending",
      providerCode: "zarinpal",
      sellerId: "d831f9e6-a377-4169-bc92-f2338eefe55c",
      query: "A0000000001",
      from: "2026-09-01",
      to: "2026-09-13"
    });

    assert.deepEqual(query?.orderBy, [{ created_at: "desc" }, { id: "desc" }]);
    assert.deepEqual(query?.cursor, { id: "d3b59a08-80f8-4f91-a11e-90dbd1f8949a" });
    assert.equal(query?.skip, 1);
    assert.equal(query?.take, 2);
    assert.deepEqual(query?.where, {
      status: "pending",
      provider: "zarinpal",
      order: { is: { seller_id: "d831f9e6-a377-4169-bc92-f2338eefe55c" } },
      OR: [
        { id: "A0000000001" },
        { order_id: "A0000000001" },
        { authority: "A0000000001" },
        { provider_ref_id: "A0000000001" }
      ],
      created_at: {
        gte: new Date("2026-09-01T00:00:00.000Z"),
        lt: new Date("2026-09-14T00:00:00.000Z")
      }
    });
    assert.equal(result.items.length, 1);
    assert.equal(result.items[0]?.amount, "125000");
    assert.equal(result.items[0]?.buyer.email, "buyer@example.com");
    assert.equal(result.nextCursor, "14b20d50-e4e2-4b99-b79d-eef84cc5667a");
    assert.equal(result.total, 2);
  });

  it("rejects enabling an unavailable adapter before writing configuration", async () => {
    const prisma = {
      sellers: { count: async () => { throw new Error("must not query sellers"); } }
    } as unknown as PrismaService;
    const payments = {
      get: () => ({ providerCode: "local-country-gateway", availability: async () => ({ available: false }) })
    } as unknown as PaymentService;
    const credentials = {
      prepareUpdate: async () => ({ data: {}, reason: null, configuration: null })
    } as unknown as PaymentCredentialService;
    const service = new PaymentApplicationService(prisma, payments, credentials);

    await assert.rejects(
      () => service.updateMethod("local-country-gateway", { enabled: true, productTypes: [], sellerIds: [] }, "admin-id"),
      /must be configured/i
    );
  });
});
