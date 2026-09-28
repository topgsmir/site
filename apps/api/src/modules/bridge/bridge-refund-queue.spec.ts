import assert from "node:assert/strict";
import test from "node:test";
import type { PrismaService } from "../../prisma/prisma.service";
import { BridgeFulfillmentService } from "./bridge-fulfillment.service";

test("refund requests use a bounded stable cursor page", async () => {
  const queries: unknown[] = [];
  const prisma = {
    bridge_fulfillments: {
      findMany: async (query: unknown) => {
        queries.push(query);
        return [{ id: "first" }, { id: "second" }, { id: "third" }];
      }
    }
  } as unknown as PrismaService;
  const service = new BridgeFulfillmentService(prisma, null as never, null as never);
  const page = await service.listRefundRequests({ limit: 2, cursor: "cursor-id" });

  assert.deepEqual(page.items.map((item) => item.id), ["first", "second"]);
  assert.equal(page.nextCursor, "second");
  assert.deepEqual(queries[0], {
    where: { status: "refund_requested" },
    cursor: { id: "cursor-id" },
    skip: 1,
    take: 3,
    select: {
      id: true,
      last_error_code: true,
      created_at: true,
      order_item: { select: { order: { select: {
        id: true, total_amount: true, currency: true,
        seller: { select: { id: true, shop_name: true } },
        payment_attempts: { where: { status: "succeeded" }, orderBy: [{ created_at: "desc" }, { id: "desc" }], select: { id: true, authority: true, provider_ref_id: true }, take: 1 }
      } } } }
    },
    orderBy: [{ created_at: "asc" }, { id: "asc" }]
  });
});
