import { ConflictException } from "@nestjs/common";
import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { AppUser } from "@topgsm/shared-types";
import { Prisma } from "../../prisma/client";
import type { PrismaService } from "../../prisma/prisma.service";
import type { ShippingProvider } from "./shipping-provider";
import type { ShippingProviderRegistry } from "./shipping-provider.registry";
import { ShippingService } from "./shipping.service";
import type { ShippingTenantService } from "./shipping-tenant.service";

describe("ShippingService tenant isolation", () => {
  it("registers a shipment with the weight recorded when the order was created", async () => {
    let submittedWeight = 0;
    const dispatch = { id: 17, provider: "amadast", status: "registering", claim_token: "claim", attempt_count: 1, provider_order_reference: null, legacy_provider_order_id: null, provider_tracking_code: null, courier_tracking_code: null, courier_title: null, last_error_code: null, registered_at: null, tracking_synced_at: null };
    const prisma = {
      seller_memberships: { findFirst: async () => ({ seller_id: "seller-a" }) },
      shipping_dispatches: { findFirst: async () => null, updateMany: async () => ({ count: 1 }), findUniqueOrThrow: async () => ({ ...dispatch, status: "registered", provider_order_reference: "provider-17" }) },
      orders: { findFirst: async () => ({ id: "order-a", currency: "TOMAN", total_amount: new Prisma.Decimal(1100), shipping_fee: new Prisma.Decimal(100), shipping_address: { recipient_name: "Buyer", phone_number: "09121111111", province: "تهران", city: "تهران", postal_code: "1234567890", address_line: "Address" }, items: [{ product_title: "Phone", quantity: 1, shipping_weight_grams: 250, offer: { physical: { weight_grams: 900 } } }] }) },
      $transaction: async (work: (tx: unknown) => Promise<unknown>) => work({ shipping_dispatches: { findUnique: async () => null, create: async () => dispatch } })
    } as unknown as PrismaService;
    const provider = { code: "amadast", displayName: "Amadast", createShipment: async ({ order }: { order: { totalAmount: string; items: Array<{ weightGrams: number }> } }) => { submittedWeight = order.items[0]!.weightGrams; assert.equal(order.totalAmount, "1000"); return { providerOrderReference: "provider-17" }; } } as unknown as ShippingProvider;
    const tenants = { effectiveForSeller: async () => ({ provider, tenantState: {}, origin: {} }) } as unknown as ShippingTenantService;
    const service = new ShippingService(prisma, tenants, { active: () => provider } as ShippingProviderRegistry);
    await service.register({ id: "seller-user", role: "seller-admin" } as AppUser, "order-a", "11111111-1111-4111-8111-111111111111");
    assert.equal(submittedWeight, 250);
  });

  it("does not return another seller's dispatch after a global idempotency collision", async () => {
    let dispatchLookup = 0;
    let recoveryWhere: Record<string, unknown> | undefined;
    const uniqueConflict = new Prisma.PrismaClientKnownRequestError("duplicate", {
      code: "P2002",
      clientVersion: "test",
      meta: { target: ["idempotency_key"] }
    });
    const prisma = {
      seller_memberships: { findFirst: async () => ({ seller_id: "seller-a" }) },
      orders: { findFirst: async () => ({
        id: "order-a", currency: "TOMAN", total_amount: new Prisma.Decimal(100_000),
        shipping_address: { recipient_name: "Buyer", phone_number: "09121111111", province: "تهران", city: "تهران", postal_code: "1234567890", address_line: "Address" },
        items: [{ product_title: "Phone", quantity: 1, offer: { physical: { weight_grams: 500 } } }]
      }) },
      shipping_dispatches: {
        findFirst: async ({ where }: { where: Record<string, unknown> }) => {
          dispatchLookup += 1;
          if (dispatchLookup === 2) recoveryWhere = where;
          return null;
        }
      },
      $transaction: async (callback: (tx: Record<string, unknown>) => unknown) => callback({
        shipping_dispatches: {
          findUnique: async () => null,
          create: async () => { throw uniqueConflict; }
        }
      })
    } as unknown as PrismaService;
    const provider = { code: "amadast", displayName: "Amadast" } as ShippingProvider;
    const tenants = { effectiveForSeller: async () => ({ provider, tenantState: {}, origin: {} }) } as unknown as ShippingTenantService;
    const providers = { active: () => provider } as ShippingProviderRegistry;
    const service = new ShippingService(prisma, tenants, providers);

    await assert.rejects(
      () => service.register({ id: "seller-user", role: "seller-admin" } as AppUser, "order-a", "11111111-1111-4111-8111-111111111111"),
      (error: unknown) => error instanceof ConflictException && error.message === "Idempotency-Key is already in use"
    );
    assert.deepEqual(recoveryWhere?.order, { seller_id: "seller-a" });
  });
});
