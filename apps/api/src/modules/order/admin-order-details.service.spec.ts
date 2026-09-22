import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import type { AppUser } from "@topgsm/shared-types";
import type { PrismaService } from "../../prisma/prisma.service";
import { AdminOrderDetailsService } from "./admin-order-details.service";
import type { OrderService } from "./order.service";

const admin: AppUser = { id: "admin-1", fullName: "Admin", email: "admin@example.com", role: "platform-admin" };
const buyer: AppUser = { id: "buyer-1", fullName: "Buyer", email: "buyer@example.com", role: "buyer" };
const at = new Date("2026-09-20T10:00:00.000Z");
const money = { toString: () => "120000" };

describe("admin order details", () => {
  it("rejects buyers before touching order data", async () => {
    let read = false;
    const prisma = { orders: { findUnique: async () => { read = true; return null; } } } as unknown as PrismaService;
    const service = new AdminOrderDetailsService(prisma, {} as OrderService);
    await assert.rejects(() => service.get(buyer, "order-1"), ForbiddenException);
    assert.equal(read, false);
  });

  it("returns a not found response for an unknown order", async () => {
    const prisma = { orders: { findUnique: async () => null } } as unknown as PrismaService;
    const service = new AdminOrderDetailsService(prisma, {} as OrderService);
    await assert.rejects(() => service.get(admin, "missing"), NotFoundException);
  });

  it("maps payment, fulfillment, identity and event data without selecting secrets", async () => {
    let select: Record<string, unknown> | undefined;
    const record = {
      buyer_id: buyer.id, seller_id: "seller-1", checkout_id: null,
      buyer: { id: buyer.id, full_name: "Buyer", username: null, email: buyer.email, phone_number: null, role: "buyer", created_at: at, updated_at: at },
      seller: { id: "seller-1", shop_name: "Shop", phone_number: null, invited: false, approved: true, suspended_at: null, created_at: at, updated_at: at,
        user: { id: "owner-1", full_name: "Owner", email: "owner@example.com", phone_number: null } },
      shipping_address: null, shipment: null, amadast_shipment: null,
      items: [{ id: "item-1", inventory_reservation: null, digital_entitlement: [], bridge_fulfillment: null }],
      events: [{ id: "event-1", from_status: "pending", to_status: "paid", created_at: at,
        actor: { id: "owner-1", full_name: "Owner", email: "owner@example.com" } }],
      payout_records: [],
      payment_attempts: [{ id: "payment-1", checkout_payment_group_id: null, provider: "test", status: "verified",
        amount: money, currency: "TOMAN", failure_code: null, verified_at: at, refunded_at: null,
        initiation_started_at: at, created_at: at, updated_at: at, refund: null }],
      checkout: null, payment_groups: []
    };
    const prisma = {
      orders: { findUnique: async (args: { select: Record<string, unknown> }) => { select = args.select; return record; } },
      outbox_events: { findMany: async () => [] }
    } as unknown as PrismaService;
    const orders = { get: async () => ({ id: "order-1", status: "paid", items: [] }) } as unknown as OrderService;
    const result = await new AdminOrderDetailsService(prisma, orders).get(admin, "order-1");
    assert.equal(result.buyerProfile.email, buyer.email);
    assert.equal(result.sellerProfile.owner.email, "owner@example.com");
    assert.equal(result.payments[0]?.amount, "120000");
    assert.equal(result.history[0]?.toStatus, "paid");
    assert.equal(select?.request_hash, undefined);
    assert.equal(select?.idempotency_key, undefined);
    const paymentSelection = (select?.payment_attempts as { select: Record<string, unknown> }).select;
    assert.equal(paymentSelection.authority, undefined);
    assert.equal(paymentSelection.provider_ref_id, undefined);
  });
});
