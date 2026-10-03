import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Prisma } from "../../prisma/client";
import { CheckoutExpiryService } from "./checkout-expiry.service";

describe("checkout coupon expiry", () => {
  it("releases a reserved coupon once while keeping another payment group open", async () => {
    let checkoutStatus: string | undefined;
    let releasedCount = 0;
    let decremented = 0;
    const tx = {
      checkout_payment_groups: {
        findFirst: async () => ({ id: "group-1", checkout_id: "checkout-1", wallet_amount: new Prisma.Decimal(0), orders: [] }),
        update: async () => ({}),
        count: async ({ where }: { where: { status: unknown } }) => where.status === "paid" ? 0 : 1
      },
      checkouts: {
        update: async ({ data }: { data: { status: string } }) => { checkoutStatus = data.status; },
        findUnique: async () => ({ coupon_id: "coupon-1", coupon_released_at: null }),
        updateMany: async () => { releasedCount += 1; return { count: 1 }; }
      },
      orders: { count: async () => 0 },
      coupons: { update: async () => { decremented += 1; } }
    };
    const prisma = { $transaction: async (work: (client: typeof tx) => Promise<void>) => work(tx) };
    const expiry = new CheckoutExpiryService(prisma as never, {} as never);

    await (expiry as unknown as { expireGroup: (id: string) => Promise<void> }).expireGroup("group-1");

    assert.equal(checkoutStatus, "pending_payment");
    assert.equal(releasedCount, 1);
    assert.equal(decremented, 1);
  });
});

it("continues reconciling later attempts and expiring groups after one provider failure", async () => {
  const reconciled: string[] = [];
  let groupsQueried = false;
  const prisma = {
    payment_attempts: { findMany: async () => [{ id: "unavailable" }, { id: "later" }] },
    checkout_payment_groups: { findMany: async () => { groupsQueried = true; return []; } },
    inventory_reservations: { findMany: async () => [] }
  };
  const payments = { reconcileCheckoutAttempt: async (id: string) => { reconciled.push(id); if (id === "unavailable") throw new Error("provider unavailable"); } };
  const expiry = new CheckoutExpiryService(prisma as never, payments as never);
  await (expiry as unknown as { tick(): Promise<void> }).tick();
  assert.deepEqual(reconciled, ["unavailable", "later"]);
  assert.equal(groupsQueried, true);
});
