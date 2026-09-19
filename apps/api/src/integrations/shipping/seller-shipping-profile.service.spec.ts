import { strict as assert } from "node:assert";
import { ForbiddenException } from "@nestjs/common";
import { describe, it } from "node:test";
import type { AppUser } from "@topgsm/shared-types";
import type { PrismaService } from "../../prisma/prisma.service";
import { SellerShippingProfileService } from "./seller-shipping-profile.service";

const sellerActor: AppUser = { id: "user-1", fullName: "Seller", email: "seller@example.com", role: "seller-admin" };
const input = {
  enabled: true,
  senderName: "Seller Shop",
  senderMobile: "09120000000",
  province: "Tehran",
  city: "Tehran",
  addressLine: "Seller origin address",
  postalCode: "1234567890"
};

describe("SellerShippingProfileService", () => {
  it("denies a seller without the physical-product grant", async () => {
    const prisma = { seller_memberships: { findFirst: async () => null } } as unknown as PrismaService;
    await assert.rejects(() => new SellerShippingProfileService(prisma).getMine(sellerActor), ForbiddenException);
  });

  it("does not let an admin enable shipping before granting physical products", async () => {
    const prisma = {
      sellers: { findUnique: async () => ({ shop_name: "Shop", invited: false, approved: true, suspended_at: null, user: { full_name: "Owner", email: "owner@example.com" }, permissions: [] }) }
    } as unknown as PrismaService;
    await assert.rejects(() => new SellerShippingProfileService(prisma).updateAdmin("seller-1", "admin-1", input), ForbiddenException);
  });

  it("scopes seller writes to the authenticated membership and audits only changed field names", async () => {
    let upsertSellerId: string | undefined;
    let audit: Record<string, unknown> | undefined;
    const saved = { enabled: true, sender_name: "Seller Shop", sender_mobile: "09120000000", province: "Tehran", city: "Tehran", address_line: "Seller origin address", postal_code: "1234567890", updated_at: new Date("2026-09-17T00:00:00Z") };
    const prisma = {
      seller_memberships: { findFirst: async () => ({ seller_id: "seller-from-membership" }) },
      seller_shipping_profiles: { findUnique: async () => null },
      $transaction: async (callback: (tx: Record<string, unknown>) => unknown) => callback({
        seller_shipping_profiles: {
          findUnique: async () => null,
          upsert: async ({ create }: { create: { seller_id: string } }) => { upsertSellerId = create.seller_id; return saved; }
        },
        seller_shipping_profile_events: { create: async ({ data }: { data: Record<string, unknown> }) => { audit = data; return { id: "event" }; } }
      })
    } as unknown as PrismaService;

    const profile = await new SellerShippingProfileService(prisma).updateMine(sellerActor, input);
    assert.equal(upsertSellerId, "seller-from-membership");
    assert.equal(profile.enabled, true);
    assert.equal(JSON.stringify(audit).includes(input.addressLine), false);
    assert.deepEqual(audit?.changed_fields, ["enabled", "sender_name", "sender_mobile", "province", "city", "address_line", "postal_code"]);
  });
});
