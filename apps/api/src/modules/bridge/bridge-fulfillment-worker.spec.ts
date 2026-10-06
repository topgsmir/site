import assert from "node:assert/strict";
import test from "node:test";
import { ConfigService } from "@nestjs/config";
import { BridgeFulfillmentWorkerService } from "./bridge-fulfillment-worker.service";
import { BridgeFulfillmentService } from "./bridge-fulfillment.service";
import type { BridgeResult } from "./bridge.types";

type Failure = "reference" | "pending" | "completion" | "audit" | "provider" | "all-persistence" | "pending-ack" | "completion-ack" | "refund-race";

function fixture(status: BridgeResult["status"] = "pending", failure?: Failure, poll: { status?: BridgeResult["status"]; terminal?: string; loseLease?: boolean; throws?: boolean } = {}) {
  const state = {
    id: "fulfillment", status: "queued", provider_reference: null as string | null, locked_by: null as string | null,
    submit_attempts: 0, manual_retry_count: 0, last_error_code: null as string | null,
    encryption_key_id: "dummy", encrypted_input: "dummy", created_at: new Date(),
    order_item: { order: { id: "order", buyer_id: "buyer", seller_id: "seller", status: "paid" } },
    grant: { status: "active", service: { available: true, external_service_id: "service", kind: "server", connection: {
      id: "connection", status: "active", provider: "webx", base_url: "https://provider.invalid",
      encrypted_username: "dummy", encrypted_api_key: "dummy", encryption_key_id: "dummy"
    } } }
  };
  const calls = { submit: 0, poll: 0, audit: 0 };
  const transitions: string[] = [];
  const audits: Array<{ status: string; reference: string | null }> = [];
  const events: string[] = [];
  const persistenceError = () => new Error("Local persistence failed");
  const apply = (data: Record<string, unknown>) => {
    if (data.submit_attempts) state.submit_attempts++;
    else Object.assign(state, data);
    if (typeof data.status === "string") transitions.push(data.status);
  };
  const prisma = {
    $queryRaw: async () => {
      if (!["queued", "submitted", "polling"].includes(state.status)) return [];
      state.status = state.status === "queued" ? "submitting" : "polling";
      state.locked_by = runner.workerId;
      return [{ id: state.id, status: state.status }];
    },
    bridge_fulfillments: {
      findUnique: async () => structuredClone(state),
      findFirst: async () => structuredClone(state),
      update: async ({ data }: { data: Record<string, unknown> }) => { apply(data); return state; },
      updateMany: async ({ where, data }: { where: { status?: string | { in: string[] }; locked_by?: string }; data: Record<string, unknown> }) => {
        const matches = typeof where.status === "string" ? state.status === where.status : !where.status || where.status.in.includes(state.status);
        if (!matches || (where.locked_by && state.locked_by !== where.locked_by)) return { count: 0 };
        if (failure === "all-persistence") throw persistenceError();
        if (!data.status && data.provider_reference) {
          if (failure === "refund-race") { state.status = "refunded"; throw persistenceError(); }
          if (failure === "reference") throw persistenceError();
        }
        if (data.status === "submitted" && failure === "pending") throw persistenceError();
        apply(data);
        if (data.status === "submitted" && failure === "pending-ack") throw persistenceError();
        return { count: 1 };
      }
    },
    bridge_fulfillment_attempts: { create: async () => {
      calls.audit++;
      audits.push({ status: state.status, reference: state.provider_reference });
      if (failure === "audit" && calls.audit === 1) throw persistenceError();
      return {};
    } },
    seller_memberships: { findFirst: async () => ({ seller_id: "seller" }) },
    orders: { update: async () => { state.order_item.order.status = "delivered"; return {}; } },
    order_events: { create: async () => ({}) },
    outbox_events: { create: async ({ data }: { data: { event_type: string } }) => { events.push(data.event_type); return {}; } }
  };
  const database = {
    ...prisma,
    $transaction: async (callback: (transaction: typeof prisma) => Promise<void>) => {
      if (failure === "completion") throw persistenceError();
      await callback(prisma);
      if (failure === "completion-ack") throw persistenceError();
    }
  };
  const providers = { get: () => ({
    submitOrder: async (): Promise<BridgeResult> => {
      calls.submit++;
      if (failure === "provider") throw new SyntaxError("Unexpected provider response");
      return { status, providerReference: "upstream-1", ...(status === "failed" ? { diagnosticCode: "PROVIDER_REJECTED" } : {}) };
    },
    checkOrder: async (): Promise<BridgeResult> => {
      calls.poll++;
      if (poll.terminal) state.status = poll.terminal;
      if (poll.loseLease) state.locked_by = "another-worker";
      if (poll.throws) throw new Error("Provider poll failed");
      return { status: poll.status ?? "pending", providerReference: "upstream-1" };
    }
  }) };
  const crypto = {
    decrypt: (_value: string, _key: string, purpose: string) => purpose.endsWith(":input") ? JSON.stringify({ fields: {}, quantity: 1 }) : "dummy",
    encrypt: () => ({ ciphertext: "dummy", keyId: "dummy" })
  };
  const worker = new BridgeFulfillmentWorkerService(database as never, providers as never, crypto as never, new ConfigService({ DISABLE_BACKGROUND_WORKERS: "true" }));
  const runner = worker as unknown as { tick(): Promise<void>; workerId: string; logger: { error(message: string): void } };
  runner.logger.error = () => undefined;
  const seller = new BridgeFulfillmentService(database as never, crypto as never, providers as never);
  return { state, calls, transitions, audits, events, seller, tick: () => runner.tick() };
}

for (const status of ["pending", "success"] as const) {
  test(`does not resubmit accepted ${status} work when retaining the reference fails`, async () => {
    const f = fixture(status, "reference");
    await f.tick();
    assert.equal(f.state.status, "manual_required");
    assert.equal(f.state.last_error_code, "AMBIGUOUS_SUBMISSION");
    assert.equal(f.state.provider_reference, null);
    await f.tick();
    assert.equal(f.calls.submit, 1);
    assert.equal(f.transitions.includes("queued"), false);
    await assert.rejects(f.seller.retry("seller", "staff", "fulfillment"), /ambiguous submission cannot be retried/i);
  });
}

for (const [status, failure] of [["pending", "pending"], ["success", "completion"]] as const) {
  test(`retains the provider reference when ${failure} persistence fails`, async () => {
    const f = fixture(status, failure);
    await f.tick();
    assert.equal(f.state.status, "manual_required");
    assert.equal(f.state.provider_reference, "upstream-1");
    assert.equal(f.state.last_error_code, "AMBIGUOUS_SUBMISSION");
    await f.tick();
    assert.equal(f.calls.submit, 1);
    assert.equal(f.transitions.includes("queued"), false);
    await assert.rejects(f.seller.retry("seller", "staff", "fulfillment"), /upstream order is still pending/i);
  });
}

for (const [status, expected] of [["pending", "submitted"], ["success", "succeeded"], ["failed", "failed"]] as const) {
  test(`audit failure cannot downgrade durable ${expected} state or cause resubmission`, async () => {
    const f = fixture(status, "audit");
    await f.tick();
    assert.equal(f.state.status, expected);
    assert.equal(f.state.provider_reference, "upstream-1");
    assert.deepEqual(f.audits[0], { status: expected, reference: "upstream-1" });
    await f.tick();
    assert.equal(f.calls.submit, 1);
    assert.equal(f.transitions.includes("queued"), false);
    if (status === "pending") assert.equal(f.calls.poll, 1);
    if (status === "failed") {
      assert.equal(f.state.last_error_code, "PROVIDER_REJECTED");
      assert.deepEqual(f.events, ["bridge.fulfillment.failed"]);
      assert.equal(f.state.order_item.order.status, "paid");
    }
  });
}

for (const [status, failure, expected] of [["pending", "pending-ack", "submitted"], ["success", "completion-ack", "succeeded"]] as const) {
  test(`lost ${expected} acknowledgement does not downgrade the committed outcome`, async () => {
    const f = fixture(status, failure);
    await f.tick();
    assert.equal(f.state.status, expected);
    assert.equal(f.state.provider_reference, "upstream-1");
    await f.tick();
    assert.equal(f.calls.submit, 1);
    assert.equal(f.transitions.includes("manual_required"), false);
  });
}

test("unknown submission exceptions require reconciliation regardless of their message", async () => {
  const f = fixture("pending", "provider");
  await f.tick();
  assert.equal(f.state.status, "manual_required");
  assert.equal(f.state.last_error_code, "AMBIGUOUS_SUBMISSION");
  await f.tick();
  assert.equal(f.calls.submit, 1);
  await assert.rejects(f.seller.retry("seller", "staff", "fulfillment"), /ambiguous submission cannot be retried/i);
});

test("a full persistence outage leaves submitted work outside the claimable queue", async () => {
  const f = fixture("pending", "all-persistence");
  await f.tick();
  assert.equal(f.state.status, "submitting");
  await f.tick();
  assert.equal(f.calls.submit, 1);
  assert.equal(f.transitions.includes("queued"), false);
});

test("ambiguity recovery does not overwrite a concurrent terminal state", async () => {
  const f = fixture("pending", "refund-race");
  await f.tick();
  assert.equal(f.state.status, "refunded");
  await f.tick();
  assert.equal(f.calls.submit, 1);
  assert.equal(f.transitions.includes("manual_required"), false);
});

for (const [status, expected] of [["success", "succeeded"], ["failed", "failed"]] as const) {
  test(`polling preserves committed ${expected} after a lost transaction acknowledgement`, async () => {
    const f = fixture("pending", "completion-ack", { status });
    f.state.status = "submitted";
    f.state.provider_reference = "upstream-1";
    await f.tick();
    assert.equal(f.state.status, expected);
    assert.equal(f.state.locked_by, null);
    assert.deepEqual(f.events, [`bridge.fulfillment.${expected}`]);
    await f.tick();
    assert.equal(f.calls.poll, 1);
    assert.equal(f.calls.submit, 0);
    assert.equal(f.transitions.includes("polling"), false);
  });
}

for (const status of ["pending", "failed", "success"] as const) {
  test(`a stale ${status} poll cannot overwrite a concurrent refund`, async () => {
    const f = fixture("pending", undefined, { status, terminal: "refunded" });
    f.state.status = "submitted";
    f.state.provider_reference = "upstream-1";
    await f.tick();
    assert.equal(f.state.status, "refunded");
    assert.deepEqual(f.events, []);
    assert.equal(f.state.order_item.order.status, "paid");
    assert.deepEqual(f.transitions, []);
  });

  test(`a stale ${status} poll cannot release another worker's claim`, async () => {
    const f = fixture("pending", undefined, { status, loseLease: true });
    f.state.status = "submitted";
    f.state.provider_reference = "upstream-1";
    await f.tick();
    assert.equal(f.state.status, "polling");
    assert.equal(f.state.locked_by, "another-worker");
    assert.deepEqual(f.events, []);
    assert.deepEqual(f.transitions, []);
  });
}

test("poll error recovery preserves another worker's claim", async () => {
  const f = fixture("pending", undefined, { loseLease: true, throws: true });
  f.state.status = "submitted";
  f.state.provider_reference = "upstream-1";
  await f.tick();
  assert.equal(f.state.status, "polling");
  assert.equal(f.state.locked_by, "another-worker");
  assert.deepEqual(f.transitions, []);
});
