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
