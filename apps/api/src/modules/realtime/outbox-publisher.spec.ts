import assert from "node:assert/strict";
import { test } from "node:test";
import type { ConfigService } from "@nestjs/config";
import type { PrismaService } from "../../prisma/prisma.service";
import { OutboxPublisherService } from "./outbox-publisher.service";
import type { RealtimeGateway } from "./realtime.gateway";

test("a failed realtime delivery remains retryable in the outbox", async () => {
  let selected = false;
  let failed = false;
  const prisma = {
    $executeRaw: async () => 0,
    $queryRaw: async () => {
      if (selected) return [];
      selected = true;
      return [{
        event_id: "event-1", event_type: "order.created",
        payload: { buyerId: "buyer-1", sellerId: "seller-1", orderId: "order-1" }
      }];
    },
    $transaction: async () => { throw new Error("delivery must not be marked delivered"); },
    outbox_deliveries: {
      update: async (input: { data: { status: string } }) => {
        failed = input.data.status === "failed";
      }
    }
  };
  const gateway = { emitOrderCreated: async () => { throw new Error("adapter unavailable"); } };
  const publisher = new OutboxPublisherService(
    prisma as unknown as PrismaService,
    gateway as unknown as RealtimeGateway,
    {} as ConfigService
  );
  await publisher.publishBatch();
  assert.equal(failed, true);
});
