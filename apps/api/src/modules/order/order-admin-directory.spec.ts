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
    shipping_address: null, shipment: null, payment_attempts: [{ provider: "zarinpal", provider_ref_id: "bank-ref-42" }],
    items: [{ id: "item-1", product_title: "Repair file", product_type: "digital", quantity: 1 }]
  };
  const prisma = { orders: {
    findMany: async (args: typeof query) => { query = args; return [row, { ...row, id: "order-2" }]; },
    groupBy: async () => [{ status: "paid", _count: { _all: 2 } }],
    count: async () => 0
  } } as unknown as PrismaService;
  const page = await new OrderService(prisma).list(admin, { limit: 1, view: "directory", status: "paid" });
  assert.equal(query?.where.status, "paid");
  assert.equal(query?.take, 2);
  assert.deepEqual(query?.orderBy, [{ created_at: "desc" }, { id: "desc" }]);
  assert.equal(query?.select.commission_rate, undefined);
  assert.equal(query?.select.amadast_shipment, undefined);
  assert.equal(query?.select.items && "bridge_fulfillment" in (query.select.items as { select: Record<string, unknown> }).select, false);
  assert.equal(page.items.length, 1);
  assert.equal(page.nextCursor, "order-1");
  assert.deepEqual(page.statusCounts, { all: 2, pending: 0, processing: 2, completed: 0, cancelled: 0, returned: 0, other: 0 });
  assert.equal("commissionRate" in page.items[0]!, false);
  assert.deepEqual(page.items[0]!.payment, { provider: "zarinpal", reference: "bank-ref-42" });
  assert.equal("bridge" in page.items[0]!.items[0]!, false);
});

it("filters the full directory by status group and counts refunded orders once", async () => {
  let listWhere: Record<string, unknown> | undefined;
  let countsWhere: Record<string, unknown> | undefined;
  const prisma = { orders: {
    findMany: async ({ where }: { where: Record<string, unknown> }) => { listWhere = where; return []; },
    groupBy: async ({ where }: { where: Record<string, unknown> }) => {
      countsWhere = where;
      return [
        { status: "pending", _count: { _all: 3 } },
        { status: "processing", _count: { _all: 4 } },
        { status: "delivered", _count: { _all: 5 } },
        { status: "cancelled", _count: { _all: 2 } }
      ];
    },
    count: async () => 1
  } } as unknown as PrismaService;
  const page = await new OrderService(prisma).list(admin, { limit: 20, view: "directory", statusGroup: "returned", productType: "bridge" });
  assert.deepEqual(listWhere?.payment_attempts, { some: { status: "refunded" } });
  assert.deepEqual(countsWhere?.payment_attempts, { none: { status: "refunded" } });
  assert.deepEqual(listWhere?.items, { some: { product_type: "bridge" } });
  assert.deepEqual(page.statusCounts, { all: 15, pending: 3, processing: 4, completed: 5, cancelled: 2, returned: 1, other: 0 });
});

it("rejects status groups for non-directory reads and conflicting exact statuses", async () => {
  const service = new OrderService({} as PrismaService);
  await assert.rejects(() => service.list(admin, { limit: 20, statusGroup: "returned" }), /Status groups require the order directory/);
  await assert.rejects(() => service.list(admin, { limit: 20, view: "directory", status: "paid", statusGroup: "returned" }), /Choose one order status filter/);
});
