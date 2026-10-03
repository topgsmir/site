import assert from "node:assert/strict";
import { test } from "node:test";
import { SmsOutboxConsumerService } from "./sms-outbox-consumer.service";

test("club SMS outbox events remain available alongside configurable rules", async () => {
  const queued: Array<{ phone: string; template: string; parameters: Record<string, string>; key: string }> = [];
  const dispatched: string[] = [];
  const consumer = new SmsOutboxConsumerService(
    { users: { findUnique: async () => ({ phone_number: "09123456789" }) }, orders: { findUnique: async () => ({ buyer: { phone_number: "09123456789" }, seller: { phone_number: "09123456789" }, items: [{ product_type: "digital" }] }) } } as never,
    { enqueue: async (phone: string, template: string, parameters: Record<string, string>, key: string) => { queued.push({ phone, template, parameters, key }); } } as never,
    { dispatch: async (event: string) => { dispatched.push(event); } } as never,
    { get: () => "true" } as never,
    { get: async () => ({ templateIds: { clubExpiry: 1, clubRedemption: 2 } }) } as never
  );
  const dispatch = consumer as unknown as { dispatch(id: string, type: string, payload: Record<string, unknown>): Promise<void> };

  await dispatch.dispatch("club-event", "club.points.expiring", { userId: "user-id", points: 20, expiresAt: "2026-10-04" });
  await dispatch.dispatch("sale-event", "order.paid", { orderId: "order-id" });

  assert.deepEqual(queued, [{ phone: "+989123456789", template: "club_expiry", parameters: { points: "20", expiresAt: "2026-10-04" }, key: "outbox:club-event:club_expiry" }]);
  assert.deepEqual(dispatched, ["product_sold"]);
});
