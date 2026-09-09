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
    currency: "IRR",
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
      currency: "irr",
      active: true
    });

    assert.equal(written?.seller_id, "seller-1");
    assert.equal(written?.code, "WELCOME10");
    assert.equal(written?.currency, "IRR");
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
        currency: "IRR",
        active: true
      }),
      /cannot exceed 100/
    );
    await assert.rejects(
      () => service.create("seller-1", {
        code: "BAD_TIME",
        discountType: "fixed",
        discountValue: "1000",
        currency: "IRR",
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
});
