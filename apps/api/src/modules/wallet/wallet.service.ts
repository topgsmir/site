import { BadRequestException, ConflictException, Injectable, NotFoundException, ServiceUnavailableException } from "@nestjs/common";
import type { AppUser } from "@topgsm/shared-types";
import { createHash } from "node:crypto";
import { PaymentService } from "../../integrations/payments/payment.service";
import { Prisma } from "../../prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { WalletLedgerService } from "./wallet-ledger.service";
import type { WalletAdjustmentDto, WalletTopupDto } from "./dto/wallet.dto";

@Injectable()
export class WalletService {
  constructor(private readonly prisma: PrismaService, private readonly ledger: WalletLedgerService, private readonly payments: PaymentService) {}

  async topupMethods() {
    const [providers, configs] = await Promise.all([this.payments.listProviders(), this.prisma.payment_method_configs.findMany({ where: { enabled: true, provider_code: { in: ["zarinpal", "zibal"] } }, select: { provider_code: true } })]);
    const enabled = new Set(configs.map((config) => config.provider_code));
    return providers.filter((provider) => provider.available && enabled.has(provider.code) && ["zarinpal", "zibal"].includes(provider.code)).map(({ code, name }) => ({ code, name }));
  }

  async topup(actor: AppUser, body: WalletTopupDto, key: string) {
    const adapter = this.payments.get(body.provider);
    const config = await this.prisma.payment_method_configs.findFirst({ where: { provider_code: body.provider, enabled: true }, select: { provider_code: true } });
    if (!config) throw new ServiceUnavailableException("Payment provider is disabled");
    if (!(await adapter.availability()).available) throw new ServiceUnavailableException("Payment provider is unavailable");
    const amount = new Prisma.Decimal(body.amount);
    if (!amount.isInteger() || amount.lessThan(1000) || amount.greaterThan(100000000)) throw new BadRequestException("Top-up amount is outside the allowed range");
    let topup = await this.prisma.wallet_topups.findUnique({ where: { user_id_idempotency_key: { user_id: actor.id, idempotency_key: key } } });
    if (!topup) {
      try {
        topup = await this.prisma.wallet_topups.create({ data: { user_id: actor.id, provider: adapter.providerCode, amount, idempotency_key: key } });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
        topup = await this.prisma.wallet_topups.findUniqueOrThrow({ where: { user_id_idempotency_key: { user_id: actor.id, idempotency_key: key } } });
      }
    }
    if (topup.provider !== adapter.providerCode || topup.amount.comparedTo(amount) !== 0) throw new ConflictException("Idempotency-Key belongs to another top-up");
    if (topup.status === "succeeded") return { id: topup.id, status: "succeeded", amount: topup.amount.toString(), currency: "TOMAN" };
    if (topup.status === "pending" && topup.authority) return { id: topup.id, status: "pending", amount: topup.amount.toString(), currency: "TOMAN", paymentUrl: adapter.paymentUrl(topup.authority) };
    if (topup.status !== "created") throw new ConflictException("Top-up initiation is already in progress or requires reconciliation");
    const claimed = await this.prisma.wallet_topups.updateMany({ where: { id: topup.id, status: "created" }, data: { status: "initiating" } });
    if (claimed.count !== 1) throw new ConflictException("Top-up initiation is already in progress");
    let result;
    try {
      result = await this.payments.initiateWithProvider(adapter.providerCode, {
        operationId: topup.id, orderId: topup.id, sellerId: "wallet", buyerId: actor.id,
        amount: amount.toString(), currency: "TOMAN", metadata: { kind: "wallet_topup", topupId: topup.id }
      });
    } catch (error) {
      await this.prisma.wallet_topups.updateMany({ where: { id: topup.id, status: "initiating" }, data: { status: "initiation_unknown" } });
      throw error;
    }
    const stored = await this.prisma.wallet_topups.updateMany({ where: { id: topup.id, status: "initiating", authority: null }, data: { authority: result.providerReferenceId, status: "pending" } });
    if (stored.count !== 1) throw new ConflictException("Top-up initiation requires reconciliation");
    return { id: topup.id, status: "pending", amount: amount.toString(), currency: "TOMAN", paymentUrl: result.paymentUrl };
  }

  async topupStatus(actor: AppUser, id: string) {
    const topup = await this.prisma.wallet_topups.findFirst({ where: { id, user_id: actor.id }, select: { id: true, amount: true, status: true, provider: true, created_at: true, verified_at: true } });
    if (!topup) throw new NotFoundException("Wallet top-up was not found");
    return { id: topup.id, amount: topup.amount.toString(), currency: "TOMAN", status: topup.status, provider: topup.provider, createdAt: topup.created_at.toISOString(), verifiedAt: topup.verified_at?.toISOString() ?? null };
  }

  async adjust(actor: AppUser, userId: string, body: WalletAdjustmentDto, key: string) {
    const amount = new Prisma.Decimal(body.amount);
    if (!amount.isInteger() || amount.isZero() || amount.abs().greaterThan(10000000)) throw new BadRequestException("Adjustment amount is outside the allowed range");
    const reason = body.reason.trim();
    const reference = body.reference.trim();
    const operationKey = `admin:${key}`;
    return this.serializable(async (tx) => {
      const existing = await tx.wallet_entries.findUnique({ where: { operation_key: operationKey }, select: { user_id: true, amount: true, reason: true, reference_id: true, balance_after: true } });
      if (existing) {
        if (existing.user_id !== userId || existing.amount.comparedTo(amount) !== 0 || existing.reason !== reason || existing.reference_id !== reference) throw new ConflictException("Idempotency-Key belongs to another adjustment");
        return { balance: existing.balance_after.toString(), currency: "TOMAN" };
      }
      const balance = await this.ledger.apply(tx, { userId, amount, kind: amount.isPositive() ? "admin_credit" : "admin_debit", reason, referenceType: "admin", referenceId: reference, operationKey, actorUserId: actor.id });
      return { balance: balance.toString(), currency: "TOMAN" };
    });
  }

  async refundOrder(actor: AppUser, buyerId: string, orderId: string, reason: string, key: string) {
    const normalizedReason = reason.trim();
    const hash = createHash("sha256").update(JSON.stringify({ buyerId, orderId, reason: normalizedReason })).digest("hex");
    return this.serializable(async (tx) => {
      const replay = await tx.order_events.findUnique({ where: { actor_user_id_idempotency_key: { actor_user_id: actor.id, idempotency_key: key } }, select: { order_id: true, request_hash: true, action: true } });
      if (replay) {
        if (replay.order_id !== orderId || replay.request_hash !== hash || replay.action !== "status_changed") throw new ConflictException("Idempotency-Key belongs to another refund");
        return { refunded: true };
      }
      const order = await tx.orders.findFirst({ where: { id: orderId, buyer_id: buyerId }, select: {
        id: true, buyer_id: true, seller_id: true, total_amount: true, currency: true, status: true,
        payout_records: { select: { id: true, status: true } },
        payment_groups: { select: { payment_group: { select: { status: true } } } },
        payment_attempts: { select: { id: true, status: true, refund: { select: { id: true } } } },
        items: { select: { bridge_fulfillment: { select: { status: true } } } }
      } });
      if (!order) throw new NotFoundException("Order was not found");
      if (order.currency.trim() !== "TOMAN" || order.status !== "paid" || order.payout_records.some((payout) => payout.status !== "draft") || order.payment_attempts.some((attempt) => attempt.refund || ["refund_pending", "refund_unknown", "refunded"].includes(attempt.status))) throw new ConflictException("Order is not eligible for a wallet refund");
      if (!order.payout_records.length || !order.payment_attempts.some((attempt) => attempt.status === "succeeded") && !order.payment_groups.some((allocation) => allocation.payment_group.status === "paid")) throw new ConflictException("Order has no verified payment to refund");
      if (order.items.some((item) => item.bridge_fulfillment && !["waiting_payment", "queued", "failed", "manual_required"].includes(item.bridge_fulfillment.status))) throw new ConflictException("Fulfillment requires manual dispute review");
      const prior = await tx.wallet_entries.findFirst({ where: { kind: "order_refund", reference_type: "order", reference_id: orderId }, select: { id: true } });
      if (prior) throw new ConflictException("Order was already refunded to wallet");
      const changed = await tx.orders.updateMany({ where: { id: orderId, status: "paid" }, data: { status: "cancelled" } });
      if (changed.count !== 1) throw new ConflictException("Order changed during refund");
      const reservedStock = await tx.inventory_reservations.findMany({ where: { order_item: { order_id: orderId }, status: "committed" }, select: { id: true, offer_id: true, quantity: true } });
      for (const stock of reservedStock) {
        const released = await tx.inventory_reservations.updateMany({ where: { id: stock.id, status: "committed" }, data: { status: "released" } });
        if (released.count !== 1) throw new ConflictException("Inventory changed during refund");
        await tx.seller_offer_physical.update({ where: { offer_id: stock.offer_id }, data: { stock: { increment: stock.quantity } } });
      }
      await tx.bridge_fulfillments.updateMany({ where: { order_item: { order_id: orderId }, status: { in: ["waiting_payment", "queued", "failed", "manual_required"] } }, data: { status: "refunded", next_attempt_at: null } });
      await this.ledger.refundOrderToWallet(tx, { orderId, buyerId: order.buyer_id, amount: order.total_amount, reason: normalizedReason, actorId: actor.id });
      await tx.order_events.create({ data: { order_id: orderId, actor_user_id: actor.id, from_status: "paid", to_status: "cancelled", action: "status_changed", idempotency_key: key, request_hash: hash } });
      await tx.outbox_events.create({ data: { aggregate: "order", aggregate_id: orderId, event_type: "order.status.updated", dedupe_key: `order.wallet_refund:${orderId}`, payload: { orderId, buyerId: order.buyer_id, sellerId: order.seller_id, fromStatus: "paid", status: "cancelled", reason: "wallet_refund" } } });
      return { refunded: true };
    });
  }

  private async serializable<T>(work: (tx: Prisma.TransactionClient) => Promise<T>): Promise<T> {
    for (let attempt = 0; ; attempt += 1) {
      try { return await this.prisma.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); }
      catch (error) {
        if (attempt >= 2 || !(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2034") throw error;
      }
    }
  }
}
