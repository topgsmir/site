import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { Prisma } from "../../prisma/client";
import type { PrismaService } from "../../prisma/prisma.service";
import { CouponService } from "./coupon.service";

const now = new Date("2026-09-07T10:00:00.000Z");

function couponRecord(overrides: Record<string, unknown> = {}) {
  return {
    id: "34b91c96-6c02-4a8d-aadb-3caec91779fe",
    code: "WELCOME10",
    discount_type: "percentage" as const,
    discount_value: new Prisma.Decimal("10"),
    currency: "TOMAN",
    minimum_order_amount: null,
    maximum_redemptions: null,
    redeemed_count: 0,
    starts_at: now,
    expires_at: null,
    active: true,
    created_at: now,
    updated_at: now,
    ...overrides
  };
}

function adminCouponRecord(overrides: Record<string, unknown> = {}) {
  return couponRecord({
    seller: { id: "8a41296e-93fa-467a-9d5b-4dc2d00fa5a3", shop_name: "Demo shop" },
    ...overrides
  });
}

describe("CouponService", () => {
  it("derives seller ownership and normalizes code and currency", async () => {
    let written: Record<string, unknown> | undefined;
    const prisma = {
      coupons: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          written = data;
          return couponRecord({ code: data.code, currency: data.currency });
        }
      }
    } as unknown as PrismaService;
    const service = new CouponService(prisma);

    const result = await service.create("seller-1", {
      code: "welcome10",
      discountType: "percentage",
      discountValue: "10",
      currency: "toman",
      active: true
    });

    assert.equal(written?.seller_id, "seller-1");
    assert.equal(written?.code, "WELCOME10");
    assert.equal(written?.currency, "TOMAN");
    assert.equal(result.code, "WELCOME10");
  });

  it("rejects invalid percentage and schedule invariants before writing", async () => {
    let writes = 0;
    const prisma = {
      coupons: { create: async () => { writes += 1; return couponRecord(); } }
    } as unknown as PrismaService;
    const service = new CouponService(prisma);

    await assert.rejects(
      () => service.create("seller-1", {
        code: "TOO_MUCH",
        discountType: "percentage",
        discountValue: "100.01",
        currency: "TOMAN",
        active: true
      }),
      /cannot exceed 100/
    );
    await assert.rejects(
      () => service.create("seller-1", {
        code: "BAD_TIME",
        discountType: "fixed",
        discountValue: "1000",
        currency: "TOMAN",
        startsAt: "2026-09-08T00:00:00.000Z",
        expiresAt: "2026-09-07T00:00:00.000Z",
        active: true
      }),
      /expiry must be after/
    );
    assert.equal(writes, 0);
  });

  it("keeps seller scoping on paginated reads", async () => {
    let query: Record<string, unknown> | undefined;
    const prisma = {
      coupons: {
        findMany: async (input: Record<string, unknown>) => {
          query = input;
          return [couponRecord()];
        }
      }
    } as unknown as PrismaService;
    const service = new CouponService(prisma);

    const page = await service.listMine("seller-2", { limit: 20 });

    assert.deepEqual(query?.where, { seller_id: "seller-2" });
    assert.equal(page.items.length, 1);
    assert.equal(page.nextCursor, null);
  });

  it("lists every seller coupon for admins and maps the seller identity", async () => {
    let query: Record<string, unknown> | undefined;
    const prisma = {
      coupons: {
        findMany: async (input: Record<string, unknown>) => {
          query = input;
          return [adminCouponRecord()];
        }
      }
    } as unknown as PrismaService;
    const service = new CouponService(prisma);

    const page = await service.listAdmin({ limit: 20 });

    assert.equal(query?.where, undefined);
    assert.deepEqual(page.items[0].seller, {
      id: "8a41296e-93fa-467a-9d5b-4dc2d00fa5a3",
      shopName: "Demo shop"
    });
  });

  it("supports an explicit seller filter on the admin list", async () => {
    let query: Record<string, unknown> | undefined;
    const prisma = {
      coupons: {
        findMany: async (input: Record<string, unknown>) => {
          query = input;
          return [];
        }
      }
    } as unknown as PrismaService;
    const service = new CouponService(prisma);
    const sellerId = "8a41296e-93fa-467a-9d5b-4dc2d00fa5a3";

    await service.listAdmin({ limit: 20, sellerId });

    assert.deepEqual(query?.where, { seller_id: sellerId });
  });

  it("creates an admin coupon only for an existing seller", async () => {
    let written: Record<string, unknown> | undefined;
    const prisma = {
      sellers: { findUnique: async () => ({ id: "seller-1" }) },
      coupons: {
        create: async ({ data }: { data: Record<string, unknown> }) => {
          written = data;
          return adminCouponRecord({ seller: { id: "seller-1", shop_name: "Seller one" } });
        }
      }
    } as unknown as PrismaService;
    const service = new CouponService(prisma);

    const result = await service.createAdmin({
      sellerId: "seller-1",
      code: "ADMIN10",
      discountType: "percentage",
      discountValue: "10",
      currency: "TOMAN",
      active: true
    });

    assert.equal(written?.seller_id, "seller-1");
    assert.equal(result.seller.shopName, "Seller one");
  });

  it("validates admin updates against the redeemed count", async () => {
    let updates = 0;
    const prisma = {
      coupons: {
        findUnique: async () => couponRecord({ redeemed_count: 4, maximum_redemptions: 10 }),
        update: async () => { updates += 1; return adminCouponRecord(); }
      }
    } as unknown as PrismaService;
    const service = new CouponService(prisma);

    await assert.rejects(
      () => service.updateAdmin("34b91c96-6c02-4a8d-aadb-3caec91779fe", {
        maximumRedemptions: 3
      }),
      /below the redeemed count/
    );
    assert.equal(updates, 0);
  });

  it("deletes by coupon id and reports a missing record", async () => {
    let count = 1;
    const prisma = {
      coupons: { deleteMany: async () => ({ count }) }
    } as unknown as PrismaService;
    const service = new CouponService(prisma);

    assert.deepEqual(await service.deleteAdmin("34b91c96-6c02-4a8d-aadb-3caec91779fe"), { deleted: true });
    count = 0;
    await assert.rejects(
      () => service.deleteAdmin("34b91c96-6c02-4a8d-aadb-3caec91779fe"),
      /Coupon not found/
    );
  });
});
