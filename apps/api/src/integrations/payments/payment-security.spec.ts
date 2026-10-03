import assert from "node:assert/strict";
import { it } from "node:test";
import type { AppUser } from "@topgsm/shared-types";
import { Prisma } from "../../prisma/client";
import { PaymentApplicationService } from "./payment-application.service";
const buyer = { id: "buyer", role: "buyer" } as AppUser;
const admin = { id: "admin", role: "platform-admin" } as AppUser;
const amount = new Prisma.Decimal(1000);
for (const order of [{ checkout_id: "checkout", items: [{ product_type: "bridge" }] }, ...["physical", "digital", "service"].map((type) => ({ checkout_id: null, items: [{ product_type: type }] }))]) {
  it(`rejects standalone payment for ${order.checkout_id ?? order.items[0]!.product_type}`, async () => {
    const service = new PaymentApplicationService({ orders: { findFirst: async () => order } } as never, { get: () => ({}) } as never, {} as never);
    await assert.rejects(() => service.initiate(buyer, "order", "key", "zibal"), /checkout payment group/);
  });
}
it("rechecks pending order state atomically before contacting the gateway", async () => {
  let called = false;
  const attempt = { id: "attempt", status: "created", amount, currency: "TOMAN", provider: "zibal" };
  const prisma = {
    orders: { findFirst: async () => ({ id: "order", status: "pending", checkout_id: null, items: [{ product_type: "bridge" }], total_amount: amount, currency: "TOMAN" }) },
    payment_method_configs: { findFirst: async () => ({}) }, payment_attempts: { findUnique: async () => attempt },
    $transaction: async (work: (tx: unknown) => unknown) => work({ orders: { updateMany: async () => ({ count: 0 }) } })
  };
  const payments = { get: () => ({ providerCode: "zibal", availability: async () => ({ available: true }) }), initiateWithProvider: async () => { called = true; } };
  const service = new PaymentApplicationService(prisma as never, payments as never, {} as never);
  await assert.rejects(() => service.initiate(buyer, "order", "key", "zibal"), /not awaiting payment/);
  assert.equal(called, false);
});
for (const outcome of [null, false] as const) {
  it(`retains ambiguous attempts and releases only terminal provider failures (${outcome})`, async () => {
    const updates: Array<Record<string, unknown>> = [];
    const prisma = { payment_attempts: {
      findFirst: async () => ({ id: "attempt", provider: "zibal", authority: "123", amount }),
      updateMany: async ({ data }: { data: Record<string, unknown> }) => { updates.push(data); return { count: 1 }; }
    } };
    const service = new PaymentApplicationService(prisma as never, { get: () => ({ inquiry: async () => outcome }) } as never, {} as never);
    await service.reconcileCheckoutAttempt("attempt");
    assert.ok(updates[0]!.updated_at instanceof Date);
    assert.equal(updates[1]!.status, outcome === false ? "failed" : undefined);
  });
}
it("requires confirmed refund evidence to resolve a captured late payment", async () => {
  const tx = { outbox_events: { findUnique: async () => null }, payment_attempts: {
    findUnique: async () => ({ status: "pending", verified_at: new Date() }), findFirst: async () => ({ id: "attempt" })
  } };
  const service = new PaymentApplicationService({ $transaction: async (work: (tx: unknown) => unknown) => work(tx) } as never, {} as never, {} as never);
  await assert.rejects(() => service.resolveAttempt(buyer, "attempt", { outcome: "refunded", providerEvidence: "provider-ticket-123", confirm: true }, "key"), /administrator/);
  await assert.rejects(() => service.resolveAttempt(admin, "attempt", { outcome: "cancelled", providerEvidence: "provider-ticket-123", confirm: true }, "key"), /confirmed refund evidence/);
});
it("persists a verified late payment before reporting the need for operator recovery", async () => {
  const updates: Array<Record<string, unknown>> = [];
  let audited = false;
  const attempt = { id: "attempt", order_id: "order", provider: "zibal", status: "pending", amount, currency: "TOMAN", order: { id: "order", status: "cancelled", total_amount: amount, currency: "TOMAN" } };
  const tx = {
    payment_attempts: { findUniqueOrThrow: async () => attempt, updateMany: async ({ data }: { data: Record<string, unknown> }) => { updates.push(data); return { count: 1 }; } },
    outbox_events: { upsert: async () => { audited = true; } }
  };
  const prisma = { wallet_topups: { findUnique: async () => null }, payment_attempts: { findUnique: async () => attempt }, $transaction: async (work: (tx: unknown) => unknown) => work(tx) };
  const service = new PaymentApplicationService(prisma as never, { get: () => ({ verify: async () => ({ verified: true, referenceId: "reference" }) }) } as never, {} as never);
  await assert.rejects(() => service.callback("zibal", "123", "OK"), /operator refund review/);
  assert.equal(updates[0]!.failure_code, "PAYMENT_RECEIVED_REVIEW_REQUIRED");
  assert.equal(updates[0]!.provider_ref_id, "reference");
  assert.equal(audited, true);
});

it("records and idempotently replays an operator resolution without repeating money changes", async () => {
  let audit: { payload: { requestHash: string } } | null = null;
  let changed = 0;
  const tx = {
    payment_attempts: {
      findUnique: async () => ({ status: "initiation_unknown", verified_at: null }), findFirst: async () => ({ id: "attempt" }),
      updateMany: async ({ data }: { data: { status: string } }) => { assert.equal(data.status, "failed"); changed += 1; return { count: 1 }; }
    },
    outbox_events: { findUnique: async () => audit, create: async ({ data }: { data: { payload: { requestHash: string } } }) => { audit = data; } }
  };
  const service = new PaymentApplicationService({ $transaction: async (work: (tx: unknown) => unknown) => work(tx) } as never, {} as never, {} as never);
  const input = { outcome: "cancelled" as const, providerEvidence: "provider-ticket-cancelled-123", confirm: true };
  assert.deepEqual(await service.resolveAttempt(admin, "attempt", input, "key"), { resolved: true });
  assert.deepEqual(await service.resolveAttempt(admin, "attempt", input, "key"), { resolved: true });
  assert.equal(changed, 1);
  await assert.rejects(() => service.resolveAttempt(admin, "other-attempt", input, "key"), /another resolution/);
});

it("records a confirmed refund when an ambiguous initiation lost its authority", async () => {
  let update: { status: string; failure_code: string; refunded_at: Date } | undefined;
  const tx = {
    payment_attempts: {
      findUnique: async () => ({ status: "initiation_unknown", authority: null, verified_at: null }), findFirst: async () => ({ id: "attempt" }),
      updateMany: async ({ data }: { data: typeof update }) => { update = data; return { count: 1 }; }
    }, outbox_events: { findUnique: async () => null, create: async () => ({}) }
  };
  const service = new PaymentApplicationService({ $transaction: async (work: (tx: unknown) => unknown) => work(tx) } as never, {} as never, {} as never);
  await service.resolveAttempt(admin, "attempt", { outcome: "refunded", providerEvidence: "provider-refund-ticket-123", confirm: true }, "key");
  assert.equal(update?.status, "failed");
  assert.equal(update?.failure_code, "OPERATOR_CONFIRMED_REFUND");
  assert.ok(update?.refunded_at instanceof Date);
});

it("safely closes a crashed unstarted attempt without requiring a nonexistent initiation timestamp", async () => {
  let changed = false;
  const tx = {
    payment_attempts: {
      findUnique: async () => ({ status: "created", authority: null, verified_at: null }),
      findFirst: async () => { throw new Error("Created attempts need no provider staleness check"); },
      updateMany: async ({ where, data }: { where: { status: string }; data: { status: string } }) => {
        assert.equal(where.status, "created"); assert.equal(data.status, "failed"); changed = true; return { count: 1 };
      }
    }, outbox_events: { findUnique: async () => null, create: async () => ({}) }
  };
  const service = new PaymentApplicationService({ $transaction: async (work: (tx: unknown) => unknown) => work(tx) } as never, {} as never, {} as never);
  await assert.rejects(() => service.resolveAttempt(admin, "attempt", { outcome: "refunded", providerEvidence: "unstarted attempt inspection", confirm: true }, "key"), /only be cancelled/);
  assert.deepEqual(await service.resolveAttempt(admin, "attempt", { outcome: "cancelled", providerEvidence: "unstarted attempt inspection", confirm: true }, "key"), { resolved: true });
  assert.equal(changed, true);
});
