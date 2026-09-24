import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createBridgeCheckoutAttempt } from "../apps/web/src/components/bridge/bridge-checkout-attempt.ts";

const input = () => ({ offerId: "offer-a", quantity: 1, trafficSource: "direct", bridgeFields: [{ key: "imei", value: "123456789012345" }] });
const payment = { paymentUrl: "https://payments.example/checkout" };

describe("bridge checkout retries", () => {
  it("reuses the saved order and payment key after payment initiation fails", async () => {
    const orders = [];
    const payments = [];
    const attempt = createBridgeCheckoutAttempt(input(), {
      async createOrder(body, key) { orders.push({ body, key }); return { id: "order-a" }; },
      async initiatePayment(orderId, key) {
        payments.push({ orderId, key });
        if (payments.length === 1) throw new Error("Payment unavailable");
        return payment;
      },
    });
    await assert.rejects(attempt.pay(), /Payment unavailable/);
    assert.equal(attempt.orderId, "order-a");
    assert.deepEqual(await attempt.pay(), payment);
    assert.equal(orders.length, 1);
    assert.deepEqual(payments[1], payments[0]);
    assert.notEqual(orders[0].key, payments[0].key);
  });

  it("recovers a committed order when its response was lost", async () => {
    const storedOrders = new Map();
    const calls = [];
    const attempt = createBridgeCheckoutAttempt(input(), {
      async createOrder(body, key) {
        calls.push({ body, key });
        if (!storedOrders.has(key)) {
          storedOrders.set(key, { id: "committed-order" });
          throw new Error("Response lost after commit");
        }
        return storedOrders.get(key);
      },
      async initiatePayment(orderId) { assert.equal(orderId, "committed-order"); return payment; },
    });
    await assert.rejects(attempt.pay(), /Response lost/);
    assert.equal(attempt.orderId, undefined);
    await attempt.pay();
    assert.equal(storedOrders.size, 1);
    assert.deepEqual(calls[1], calls[0]);
  });

  it("recovers a payment response using the same provider attempt", async () => {
    const storedPayments = new Map();
    let orders = 0;
    const attempt = createBridgeCheckoutAttempt(input(), {
      async createOrder() { orders++; return { id: "order-a" }; },
      async initiatePayment(orderId, key) {
        const operation = `${orderId}:${key}`;
        if (!storedPayments.has(operation)) {
          storedPayments.set(operation, payment);
          throw new Error("Payment response lost");
        }
        return storedPayments.get(operation);
      },
    });
    await assert.rejects(attempt.pay(), /Payment response lost/);
    assert.deepEqual(await attempt.pay(), payment);
    assert.equal(orders, 1);
    assert.equal(storedPayments.size, 1);
  });

  it("joins overlapping submissions into a single request sequence", async () => {
    let release;
    let orders = 0;
    let payments = 0;
    const waiting = new Promise((resolve) => { release = resolve; });
    const attempt = createBridgeCheckoutAttempt(input(), {
      async createOrder() { orders++; await waiting; return { id: "order-a" }; },
      async initiatePayment() { payments++; return payment; },
    });
    const first = attempt.pay();
    const second = attempt.pay();
    assert.equal(first, second);
    release();
    await Promise.all([first, second]);
    assert.equal(orders, 1);
    assert.equal(payments, 1);
  });

  it("snapshots the order details so retries cannot change an existing intent", async () => {
    const draft = input();
    const calls = [];
    const attempt = createBridgeCheckoutAttempt(draft, {
      async createOrder(body) { calls.push(body); if (calls.length === 1) throw new Error("Timeout"); return { id: "order-a" }; },
      async initiatePayment() { return payment; },
    });
    await assert.rejects(attempt.pay(), /Timeout/);
    draft.quantity = 5;
    draft.bridgeFields[0].value = "different-device";
    await attempt.pay();
    assert.deepEqual(calls[1], input());
  });

  it("does not bypass an ambiguous provider outcome with a fresh key", async () => {
    let orders = 0;
    const keys = new Set();
    const attempt = createBridgeCheckoutAttempt(input(), {
      async createOrder() { orders++; return { id: "order-a" }; },
      async initiatePayment(_orderId, key) { keys.add(key); throw new Error("Reconciliation required"); },
    });
    for (let retry = 0; retry < 3; retry++) await assert.rejects(attempt.pay(), /Reconciliation required/);
    assert.equal(orders, 1);
    assert.equal(keys.size, 1);
  });
});
