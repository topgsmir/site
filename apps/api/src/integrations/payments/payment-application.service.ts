import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { Prisma } from "../../prisma/client";
import type { AppUser } from "@topgsm/shared-types";
import { createHash, randomUUID } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { PaymentService } from "./payment.service";

@Injectable()
export class PaymentApplicationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentService
  ) {}

  async initiate(actor: AppUser, orderId: string, idempotencyKey: string) {
    if (actor.role !== "buyer") throw new ForbiddenException("Only buyers can pay for orders");
    const order = await this.prisma.orders.findFirst({
      where: { id: orderId, buyer_id: actor.id },
      select: {
        id: true,
        buyer_id: true,
        seller_id: true,
        status: true,
        total_amount: true,
        currency: true
      }
    });
    if (!order) throw new NotFoundException("Order was not found");
    if (order.status !== "pending") throw new ConflictException("Order is not awaiting payment");

    let attempt = await this.prisma.payment_attempts.findUnique({
      where: { order_id_idempotency_key: { order_id: order.id, idempotency_key: idempotencyKey } }
    });
    if (!attempt) {
      try {
        attempt = await this.prisma.payment_attempts.create({
          data: {
            order_id: order.id,
            provider: "zarinpal",
            amount: order.total_amount,
            currency: order.currency.trim(),
            idempotency_key: idempotencyKey
          }
        });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
        attempt = await this.prisma.payment_attempts.findUniqueOrThrow({
          where: { order_id_idempotency_key: { order_id: order.id, idempotency_key: idempotencyKey } }
        });
      }
    }
    if (attempt.amount.comparedTo(order.total_amount) !== 0 || attempt.currency.trim() !== order.currency.trim()) {
      throw new ConflictException("Stored payment amount does not match the order");
    }
    if (attempt.status === "succeeded") return this.result(attempt.order_id, attempt.authority!, attempt.provider_ref_id, "succeeded");
    if (attempt.authority) return this.result(attempt.order_id, attempt.authority, attempt.provider_ref_id, attempt.status === "created" ? "pending" : attempt.status);

    const result = await this.payments.initiateWithProvider("zarinpal", {
      orderId: order.id,
      sellerId: order.seller_id,
      buyerId: order.buyer_id,
      amount: order.total_amount.toString(),
      currency: order.currency.trim()
    });
    await this.prisma.payment_attempts.update({
      where: { id: attempt.id },
      data: { authority: result.providerReferenceId, status: "pending", failure_code: null }
    });
    return { orderId: order.id, authority: result.providerReferenceId, paymentUrl: result.paymentUrl, status: "pending" };
  }

  async callback(authority: string, callbackStatus: string | undefined) {
    if (typeof authority !== "string" || !/^[A-Za-z0-9-]{10,128}$/.test(authority)) {
      throw new BadRequestException("Payment authority is invalid");
    }
    const attempt = await this.prisma.payment_attempts.findUnique({
      where: { authority },
      include: { order: { select: { id: true, buyer_id: true, seller_id: true, status: true, total_amount: true, currency: true } } }
    });
    if (!attempt || attempt.provider !== "zarinpal") throw new NotFoundException("Payment attempt was not found");
    if (attempt.status === "succeeded") return this.result(attempt.order_id, authority, attempt.provider_ref_id, "succeeded");
    if (attempt.amount.comparedTo(attempt.order.total_amount) !== 0 || attempt.currency.trim() !== attempt.order.currency.trim()) {
      throw new ConflictException("Payment amount integrity check failed");
    }
    if (callbackStatus && callbackStatus.toUpperCase() !== "OK") {
      await this.prisma.payment_attempts.update({ where: { id: attempt.id }, data: { status: "failed", failure_code: "BUYER_CANCELLED" } });
      return { orderId: attempt.order_id, authority, status: "failed", failureCode: "BUYER_CANCELLED" };
    }
    const verification = await this.payments.get("zarinpal").verify(authority, attempt.amount.toString());
    if (!verification.verified) {
      await this.prisma.payment_attempts.update({ where: { id: attempt.id }, data: { status: "failed", failure_code: "VERIFICATION_FAILED" } });
      return { orderId: attempt.order_id, authority, status: "failed", failureCode: "VERIFICATION_FAILED" };
    }

    const result = await this.prisma.$transaction(async (transaction) => {
      const current = await transaction.payment_attempts.findUniqueOrThrow({ where: { id: attempt.id } });
      if (current.status === "succeeded") return current;
      if (attempt.order.status !== "pending") throw new ConflictException("Order is not awaiting payment");
      const updated = await transaction.payment_attempts.update({
        where: { id: current.id },
        data: { status: "succeeded", provider_ref_id: verification.referenceId, verified_at: new Date(), failure_code: null }
      });
      await transaction.orders.update({ where: { id: attempt.order.id }, data: { status: "paid" } });
      await transaction.bridge_fulfillments.updateMany({
        where: { order_item: { order_id: attempt.order.id }, status: "waiting_payment" },
        data: { status: "queued", next_attempt_at: new Date() }
      });
      await transaction.bridge_fulfillments.updateMany({
        where: { order_item: { order_id: attempt.order.id }, mode: "manual", status: "queued" },
        data: { status: "manual_required", next_attempt_at: null }
      });
      const eventKey = randomUUID();
      await transaction.order_events.create({
        data: {
          order_id: attempt.order.id,
          actor_user_id: attempt.order.buyer_id,
          from_status: "pending",
          to_status: "paid",
          idempotency_key: eventKey,
          request_hash: this.hash({ authority, referenceId: verification.referenceId })
        }
      });
      await transaction.outbox_events.create({
        data: {
          aggregate: "order",
          aggregate_id: attempt.order.id,
          event_type: "order.paid",
          dedupe_key: `order.paid:${attempt.order.id}`,
          payload: {
            orderId: attempt.order.id,
            buyerId: attempt.order.buyer_id,
            sellerId: attempt.order.seller_id,
            status: "paid"
          }
        }
      });
      return updated;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return this.result(attempt.order_id, authority, result.provider_ref_id, "succeeded");
  }

  async refund(attemptId: string, reason: string) {
    const attempt = await this.prisma.payment_attempts.findUnique({
      where: { id: attemptId }, include: { order: { select: { id: true, status: true } } }
    });
    if (!attempt || attempt.status !== "succeeded" || !attempt.authority) {
      throw new ConflictException("Payment is not eligible for a refund");
    }
    if (attempt.order.status === "delivered") throw new ConflictException("Delivered orders require manual dispute review");
    const refunded = await this.payments.get("zarinpal").refund(attempt.authority, attempt.amount.toString(), reason.trim());
    if (!refunded) throw new ConflictException("The payment provider did not confirm the refund");
    await this.prisma.$transaction([
      this.prisma.payment_attempts.update({ where: { id: attempt.id }, data: { status: "refunded", refunded_at: new Date() } }),
      this.prisma.orders.update({ where: { id: attempt.order.id }, data: { status: "cancelled" } }),
      this.prisma.bridge_fulfillments.updateMany({ where: { order_item: { order_id: attempt.order.id } }, data: { status: "refunded", completed_at: new Date(), next_attempt_at: null } })
    ]);
    return { refunded: true };
  }

  private result(orderId: string, authority: string, referenceId: string | null, status: "pending" | "succeeded" | "failed" | "refunded") {
    return { orderId, authority, referenceId, status, paymentUrl: status === "pending" ? `https://www.zarinpal.com/pg/StartPay/${authority}` : undefined };
  }

  private hash(value: unknown) {
    return createHash("sha256").update(JSON.stringify(value)).digest("hex");
  }
}
