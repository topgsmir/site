import { strict as assert } from "node:assert";
import { it } from "node:test";
import type { AppUser } from "@topgsm/shared-types";
import type { PrismaService } from "../../prisma/prisma.service";
import { OrderService } from "./order.service";

const admin: AppUser = { id: "admin-1", fullName: "Admin", email: "admin@example.com", role: "platform-admin" };

it("returns a narrow, cursor-paginated platform order directory", async () => {
  let query: { where: Record<string, unknown>; select: Record<string, unknown>; take: number; orderBy: unknown } | undefined;
  const row = {
    id: "order-1", status: "paid", currency: "TOMAN", total_amount: { toString: () => "120000" },
    traffic_source: "google", created_at: new Date("2026-09-19T10:00:00.000Z"),
    seller: { shop_name: "Seller" }, buyer: { full_name: "Buyer", email: "buyer@example.com", phone_number: null },
    shipping_address: null, shipment: null,
    items: [{ id: "item-1", product_title: "Repair file", product_type: "digital", quantity: 1 }]
  };
  const prisma = { orders: { findMany: async (args: typeof query) => { query = args; return [row, { ...row, id: "order-2" }]; } } } as unknown as PrismaService;
  const page = await new OrderService(prisma).list(admin, { limit: 1, view: "directory", status: "paid" });
  assert.equal(query?.where.status, "paid");
  assert.equal(query?.take, 2);
  assert.deepEqual(query?.orderBy, [{ created_at: "desc" }, { id: "desc" }]);
  assert.equal(query?.select.commission_rate, undefined);
  assert.equal(query?.select.amadast_shipment, undefined);
  assert.equal(query?.select.items && "bridge_fulfillment" in (query.select.items as { select: Record<string, unknown> }).select, false);
  assert.equal(page.items.length, 1);
  assert.equal(page.nextCursor, "order-1");
  assert.equal("commissionRate" in page.items[0]!, false);
  assert.equal("bridge" in page.items[0]!.items[0]!, false);
});
