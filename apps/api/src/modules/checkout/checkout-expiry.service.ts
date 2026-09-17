import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { randomUUID, createHash } from "node:crypto";
import { PaymentApplicationService } from "../../integrations/payments/payment-application.service";
import { Prisma } from "../../prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

@Injectable()
export class CheckoutExpiryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(CheckoutExpiryService.name);
  private timer?: NodeJS.Timeout;

  constructor(private readonly prisma: PrismaService, private readonly payments: PaymentApplicationService) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.tick(), 60_000);
    this.timer.unref();
  }

  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  private async tick() {
    try {
      const staleAttempts = await this.prisma.payment_attempts.findMany({
        where: { checkout_payment_group_id: { not: null }, status: "pending", updated_at: { lt: new Date(Date.now() - 30 * 60 * 1000) } },
        select: { id: true }, take: 10, orderBy: { updated_at: "asc" }
      });
      for (const attempt of staleAttempts) await this.payments.reconcileCheckoutAttempt(attempt.id);

      const groups = await this.prisma.checkout_payment_groups.findMany({
        where: { status: { in: ["pending", "failed"] }, expires_at: { lt: new Date() }, attempts: { none: { status: { in: ["pending", "initiating", "initiation_unknown"] } } } },
        select: { id: true }, take: 20, orderBy: { expires_at: "asc" }
      });
      for (const group of groups) await this.expireGroup(group.id);

      const legacy = await this.prisma.inventory_reservations.findMany({
        where: { status: "active", expires_at: { lt: new Date() }, order_item: { order: { checkout_id: null, status: "pending", payment_attempts: { none: { status: { in: ["pending", "initiating", "initiation_unknown"] } } } } } },
        select: { order_item: { select: { order_id: true } } }, take: 20
      });
      for (const item of legacy) await this.releaseOrder(item.order_item.order_id);
    } catch (error) {
      this.logger.error(`Checkout expiry tick failed: ${error instanceof Error ? error.constructor.name : "UnknownError"}`);
    }
  }

  private async expireGroup(groupId: string) {
    await this.prisma.$transaction(async (tx) => {
      const group = await tx.checkout_payment_groups.findFirst({
        where: { id: groupId, status: { in: ["pending", "failed"] }, expires_at: { lt: new Date() }, attempts: { none: { status: { in: ["pending", "initiating", "initiation_unknown"] } } } },
        select: { id: true, checkout_id: true, orders: { select: { order_id: true } } }
      });
      if (!group) return;
      await tx.checkout_payment_groups.update({ where: { id: group.id }, data: { status: "expired" } });
      for (const allocation of group.orders) await this.releaseOrderInTransaction(tx, allocation.order_id);
      const paid = await tx.checkout_payment_groups.count({ where: { checkout_id: group.checkout_id, status: "paid" } });
      await tx.checkouts.update({ where: { id: group.checkout_id }, data: { status: paid > 0 ? "partially_paid" : "expired" } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private releaseOrder(orderId: string) {
    return this.prisma.$transaction((tx) => this.releaseOrderInTransaction(tx, orderId), { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private async releaseOrderInTransaction(tx: Prisma.TransactionClient, orderId: string) {
    const order = await tx.orders.findFirst({
      where: { id: orderId, status: "pending" },
      select: { id: true, buyer_id: true, seller_id: true, items: { select: { inventory_reservation: { select: { id: true, offer_id: true, quantity: true, status: true } } } } }
    });
    if (!order) return;
    const changed = await tx.orders.updateMany({ where: { id: order.id, status: "pending" }, data: { status: "cancelled" } });
    if (changed.count !== 1) return;
    for (const item of order.items) {
      const reservation = item.inventory_reservation;
      if (!reservation || reservation.status !== "active") continue;
      const released = await tx.inventory_reservations.updateMany({ where: { id: reservation.id, status: "active" }, data: { status: "released" } });
      if (released.count === 1) await tx.seller_offer_physical.update({ where: { offer_id: reservation.offer_id }, data: { stock: { increment: reservation.quantity } } });
    }
    const key = randomUUID();
    const requestHash = createHash("sha256").update(JSON.stringify({ orderId, reason: "reservation_expired" })).digest("hex");
    await tx.order_events.create({ data: { order_id: order.id, actor_user_id: order.buyer_id, from_status: "pending", to_status: "cancelled", idempotency_key: key, request_hash: requestHash } });
    await tx.outbox_events.create({ data: { aggregate: "order", aggregate_id: order.id, event_type: "order.status.updated", dedupe_key: `order.expired:${order.id}`, payload: { orderId: order.id, buyerId: order.buyer_id, sellerId: order.seller_id, fromStatus: "pending", status: "cancelled", reason: "reservation_expired" } } });
  }
}
