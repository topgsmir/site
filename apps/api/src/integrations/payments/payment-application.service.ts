import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException
} from "@nestjs/common";
import { Prisma } from "../../prisma/client";
import type {
  AdminPaymentMethod,
  AdminPaymentSellerOption,
  AdminPaymentTransactionsPage,
  AppUser,
  PaymentTransactionStatus,
  ProductType
} from "@topgsm/shared-types";
import { createHash, randomUUID } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { PaymentService } from "./payment.service";
import { PaymentCredentialService, type PaymentCredentialInput } from "./payment-credential.service";

@Injectable()
export class PaymentApplicationService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentService,
    private readonly credentials: PaymentCredentialService
  ) {}

  async initiate(actor: AppUser, orderId: string, idempotencyKey: string, providerCode = "zarinpal") {
    if (actor.role !== "buyer") throw new ForbiddenException("Only buyers can pay for orders");
    const adapter = this.payments.get(providerCode);
    const order = await this.prisma.orders.findFirst({
      where: { id: orderId, buyer_id: actor.id },
      select: {
        id: true,
        buyer_id: true,
        seller_id: true,
        status: true,
        total_amount: true,
        currency: true,
        items: { select: { product_type: true }, take: 1 }
      }
    });
    if (!order) throw new NotFoundException("Order was not found");
    if (order.status !== "pending") throw new ConflictException("Order is not awaiting payment");
    const productType = order.items[0]?.product_type;
    if (!productType) throw new ConflictException("Order has no payable item");
    await this.assertMethodAllowed(adapter.providerCode, order.seller_id, productType);
    if (!(await adapter.availability()).available) {
      throw new ServiceUnavailableException("This payment method is not configured");
    }

    let attempt = await this.prisma.payment_attempts.findUnique({
      where: { order_id_idempotency_key: { order_id: order.id, idempotency_key: idempotencyKey } }
    });
    if (!attempt) {
      try {
        attempt = await this.prisma.payment_attempts.create({
          data: {
            order_id: order.id,
            provider: adapter.providerCode,
            amount: order.total_amount,
            currency: order.currency.trim(),
            idempotency_key: idempotencyKey
          }
        });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
        attempt = await this.prisma.payment_attempts.findUnique({
          where: { order_id_idempotency_key: { order_id: order.id, idempotency_key: idempotencyKey } }
        });
        if (!attempt) {
          throw new ConflictException("Another payment initiation is already active for this order");
        }
      }
    }
    if (attempt.amount.comparedTo(order.total_amount) !== 0 || attempt.currency.trim() !== order.currency.trim()) {
      throw new ConflictException("Stored payment amount does not match the order");
    }
    if (attempt.provider !== adapter.providerCode) {
      throw new ConflictException("The idempotency key belongs to a different payment provider");
    }
    if (attempt.status === "succeeded" && attempt.authority) {
      return this.result(attempt.order_id, attempt.provider, attempt.authority, attempt.provider_ref_id, "succeeded");
    }
    if (attempt.status === "pending" && attempt.authority) {
      return this.result(
        attempt.order_id,
        attempt.provider,
        attempt.authority,
        attempt.provider_ref_id,
        "pending"
      );
    }
    if (attempt.status === "initiating") {
      throw new ConflictException("Payment initiation is already in progress");
    }
    if (attempt.status === "initiation_unknown") {
      throw new ConflictException("Payment initiation has an ambiguous provider outcome and requires reconciliation");
    }
    if (attempt.status !== "created") {
      throw new ConflictException("This payment attempt cannot be initiated again");
    }

    const claimed = await this.prisma.payment_attempts.updateMany({
      where: { id: attempt.id, status: "created", authority: null },
      data: { status: "initiating", initiation_started_at: new Date(), failure_code: null }
    });
    if (claimed.count !== 1) {
      throw new ConflictException("Payment initiation is already in progress");
    }

    let result;
    try {
      result = await this.payments.initiateWithProvider(adapter.providerCode, {
        operationId: attempt.id,
        orderId: order.id,
        sellerId: order.seller_id,
        buyerId: order.buyer_id,
        amount: order.total_amount.toString(),
        currency: order.currency.trim()
      });
    } catch (error) {
      await this.markInitiationUnknown(attempt.id, error);
      throw error;
    }
    try {
      const stored = await this.prisma.payment_attempts.updateMany({
        where: { id: attempt.id, status: "initiating", authority: null },
        data: { authority: result.providerReferenceId, status: "pending", failure_code: null }
      });
      if (stored.count !== 1) {
        throw new ConflictException("Payment initiation state changed before the provider result was stored");
      }
    } catch (error) {
      await this.markInitiationUnknown(attempt.id, error);
      throw error;
    }
    return { orderId: order.id, authority: result.providerReferenceId, paymentUrl: result.paymentUrl, status: "pending" };
  }

  async initiateCheckoutGroup(actor: AppUser, checkoutId: string, groupId: string, idempotencyKey: string) {
    if (actor.role !== "buyer") throw new ForbiddenException("Only buyers can pay for checkouts");
    const group = await this.prisma.checkout_payment_groups.findFirst({
      where: { id: groupId, checkout_id: checkoutId, checkout: { buyer_id: actor.id } },
      select: {
        id: true, provider: true, status: true, amount: true, currency: true, expires_at: true,
        checkout: { select: { id: true, status: true, buyer_id: true } },
        orders: { orderBy: { order_id: "asc" }, select: { order: { select: { id: true, seller_id: true, status: true, total_amount: true } } } }
      }
    });
    if (!group) throw new NotFoundException("Checkout payment group was not found");
    if (group.status === "paid") return { checkoutId, paymentGroupId: group.id, status: "succeeded" };
    if (group.status !== "pending" || group.checkout.status === "cancelled" || group.checkout.status === "expired") {
      throw new ConflictException("This checkout payment group is not payable");
    }
    if (group.expires_at <= new Date()) throw new ConflictException("The stock reservation has expired");
    if (!group.orders.length || group.orders.some(({ order }) => order.status !== "pending")) throw new ConflictException("One or more allocated orders are not awaiting payment");
    const allocated = group.orders.reduce((sum, { order }) => sum.add(order.total_amount), new Prisma.Decimal(0));
    if (allocated.comparedTo(group.amount) !== 0) throw new ConflictException("Payment allocation integrity check failed");
    const adapter = this.payments.get(group.provider);
    if (!(await adapter.availability()).available) throw new ServiceUnavailableException("This payment method is not configured");
    const primary = group.orders[0]!.order;
    let attempt = await this.prisma.payment_attempts.findUnique({
      where: { order_id_idempotency_key: { order_id: primary.id, idempotency_key: idempotencyKey } }
    });
    if (!attempt) {
      try {
        attempt = await this.prisma.payment_attempts.create({
          data: { order_id: primary.id, checkout_payment_group_id: group.id, provider: group.provider, amount: group.amount, currency: group.currency.trim(), idempotency_key: idempotencyKey }
        });
      } catch (error) {
        if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
        attempt = await this.prisma.payment_attempts.findUnique({
          where: { order_id_idempotency_key: { order_id: primary.id, idempotency_key: idempotencyKey } }
        });
        if (!attempt) {
          throw new ConflictException("Another payment initiation is already active for this checkout");
        }
      }
    }
    if (attempt.checkout_payment_group_id !== group.id || attempt.provider !== group.provider || attempt.amount.comparedTo(group.amount) !== 0) {
      throw new ConflictException("The payment idempotency key belongs to another operation");
    }
    if (attempt.status === "succeeded") return { checkoutId, paymentGroupId: group.id, status: "succeeded" };
    if (attempt.status === "pending" && attempt.authority) {
      return { checkoutId, paymentGroupId: group.id, authority: attempt.authority, paymentUrl: adapter.paymentUrl(attempt.authority), status: "pending" };
    }
    if (attempt.status === "initiating") throw new ConflictException("Payment initiation is already in progress");
    if (attempt.status === "initiation_unknown") throw new ConflictException("Payment initiation requires reconciliation");
    if (attempt.status !== "created") throw new ConflictException("This payment attempt cannot be initiated again");
    const claimed = await this.prisma.payment_attempts.updateMany({ where: { id: attempt.id, status: "created" }, data: { status: "initiating", initiation_started_at: new Date(), failure_code: null } });
    if (claimed.count !== 1) throw new ConflictException("Payment initiation is already in progress");
    let result;
    try {
      result = await this.payments.initiateWithProvider(group.provider, {
        operationId: attempt.id, orderId: primary.id, sellerId: primary.seller_id, buyerId: actor.id,
        amount: group.amount.toString(), currency: group.currency.trim(), metadata: { checkoutId, paymentGroupId: group.id }
      });
    } catch (error) {
      await this.markInitiationUnknown(attempt.id, error);
      throw error;
    }
    const stored = await this.prisma.payment_attempts.updateMany({
      where: { id: attempt.id, status: "initiating", authority: null },
      data: { authority: result.providerReferenceId, status: "pending", failure_code: null }
    });
    if (stored.count !== 1) {
      await this.markInitiationUnknown(attempt.id, new Error("Payment state changed"));
      throw new ConflictException("Payment initiation state changed before it was stored");
    }
    return { checkoutId, paymentGroupId: group.id, authority: result.providerReferenceId, paymentUrl: result.paymentUrl, status: "pending" };
  }

  async callback(providerCode: string, authority: string, callbackStatus: string | undefined) {
    if (typeof authority !== "string" || !/^[A-Za-z0-9-]{10,128}$/.test(authority)) {
      throw new BadRequestException("Payment authority is invalid");
    }
    const attempt = await this.prisma.payment_attempts.findUnique({
      where: { provider_authority: { provider: providerCode, authority } },
      include: { order: { select: { id: true, buyer_id: true, seller_id: true, status: true, total_amount: true, currency: true } } }
    });
    if (!attempt) throw new NotFoundException("Payment attempt was not found");
    if (attempt.checkout_payment_group_id) {
      return this.callbackCheckoutGroup(attempt.id, providerCode, authority, callbackStatus);
    }
    if (attempt.status === "succeeded") return this.result(attempt.order_id, attempt.provider, authority, attempt.provider_ref_id, "succeeded");
    if (attempt.status === "refunded") return this.result(attempt.order_id, attempt.provider, authority, attempt.provider_ref_id, "refunded");
    if (attempt.status !== "pending") throw new ConflictException("Payment is not awaiting verification");
    if (attempt.amount.comparedTo(attempt.order.total_amount) !== 0 || attempt.currency.trim() !== attempt.order.currency.trim()) {
      throw new ConflictException("Payment amount integrity check failed");
    }
    const verification = await this.payments.get(attempt.provider).verify(authority, attempt.amount.toString());
    if (!verification.verified) {
      const failureCode = callbackStatus?.toUpperCase() === "NOK" ? "BUYER_CANCELLED" : "VERIFICATION_FAILED";
      const changed = await this.prisma.payment_attempts.updateMany({
        where: { id: attempt.id, status: "pending" },
        data: { status: "failed", failure_code: failureCode }
      });
      if (changed.count !== 1) throw new ConflictException("Payment changed while verification was processed");
      return { orderId: attempt.order_id, authority, status: "failed", failureCode };
    }

    const result = await this.prisma.$transaction(async (transaction) => {
      const current = await transaction.payment_attempts.findUniqueOrThrow({
        where: { id: attempt.id },
        include: { order: { select: { status: true } } }
      });
      if (current.status === "succeeded") return current;
      if (current.status !== "pending") throw new ConflictException("Payment is not awaiting verification");
      if (current.order.status !== "pending") throw new ConflictException("Order is not awaiting payment");
      const paymentChanged = await transaction.payment_attempts.updateMany({
        where: { id: current.id, status: "pending" },
        data: { status: "succeeded", provider_ref_id: verification.referenceId, verified_at: new Date(), failure_code: null }
      });
      if (paymentChanged.count !== 1) throw new ConflictException("Payment changed while it was being settled");
      const orderChanged = await transaction.orders.updateMany({
        where: { id: attempt.order.id, status: "pending" },
        data: { status: "paid" }
      });
      if (orderChanged.count !== 1) throw new ConflictException("Order changed while payment was being settled");
      await transaction.inventory_reservations.updateMany({
        where: { order_item: { order_id: attempt.order.id }, status: "active" },
        data: { status: "committed" }
      });
      const digitalItems = await transaction.order_items.findMany({
        where: { order_id: attempt.order.id, digital_delivery_url: { not: null }, digital_max_downloads: { not: null } },
        select: { id: true, digital_delivery_url: true, digital_max_downloads: true }
      });
      if (digitalItems.length) {
        await transaction.digital_entitlements.createMany({
          data: digitalItems.map((item) => ({ order_item_id: item.id, buyer_id: attempt.order.buyer_id, delivery_url: item.digital_delivery_url!, max_downloads: item.digital_max_downloads! })),
          skipDuplicates: true
        });
      }
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
      return transaction.payment_attempts.findUniqueOrThrow({ where: { id: current.id } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return this.result(attempt.order_id, attempt.provider, authority, result.provider_ref_id, "succeeded");
  }

  private async callbackCheckoutGroup(attemptId: string, providerCode: string, authority: string, callbackStatus: string | undefined) {
    const attempt = await this.prisma.payment_attempts.findUnique({
      where: { id: attemptId },
      select: {
        id: true, provider: true, status: true, amount: true, currency: true, provider_ref_id: true,
        checkout_payment_group: {
          select: {
            id: true, checkout_id: true, status: true, amount: true, currency: true,
            checkout: { select: { buyer_id: true } },
            orders: {
              select: {
                order: {
                  select: {
                    id: true, buyer_id: true, seller_id: true, status: true, total_amount: true,
                    items: { select: { id: true, digital_delivery_url: true, digital_max_downloads: true } }
                  }
                }
              }
            }
          }
        }
      }
    });
    const group = attempt?.checkout_payment_group;
    if (!attempt || !group || attempt.provider !== providerCode) throw new NotFoundException("Checkout payment attempt was not found");
    if (attempt.status === "succeeded") return { checkoutId: group.checkout_id, paymentGroupId: group.id, authority, referenceId: attempt.provider_ref_id, status: "succeeded" };
    if (attempt.status !== "pending" || group.status !== "pending") throw new ConflictException("Payment is not awaiting verification");
    const allocated = group.orders.reduce((sum, item) => sum.add(item.order.total_amount), new Prisma.Decimal(0));
    if (allocated.comparedTo(group.amount) !== 0 || attempt.amount.comparedTo(group.amount) !== 0 || attempt.currency.trim() !== group.currency.trim()) {
      throw new ConflictException("Checkout payment amount integrity check failed");
    }
    const verification = await this.payments.get(attempt.provider).verify(authority, attempt.amount.toString());
    if (!verification.verified) {
      const failureCode = callbackStatus?.toUpperCase() === "NOK" ? "BUYER_CANCELLED" : "VERIFICATION_FAILED";
      const changed = await this.prisma.payment_attempts.updateMany({ where: { id: attempt.id, status: "pending" }, data: { status: "failed", failure_code: failureCode } });
      if (changed.count !== 1) throw new ConflictException("Payment changed while verification was processed");
      return { checkoutId: group.checkout_id, paymentGroupId: group.id, authority, status: "failed", failureCode };
    }
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.checkout_payment_groups.findUniqueOrThrow({
        where: { id: group.id },
        select: { status: true, checkout_id: true, orders: { select: { order: { select: { id: true, buyer_id: true, seller_id: true, status: true, items: { select: { id: true, digital_delivery_url: true, digital_max_downloads: true } } } } } } }
      });
      if (current.status === "paid") return;
      if (current.status !== "pending" || current.orders.some(({ order }) => order.status !== "pending")) throw new ConflictException("Checkout orders are not awaiting payment");
      const changed = await tx.payment_attempts.updateMany({ where: { id: attempt.id, status: "pending" }, data: { status: "succeeded", provider_ref_id: verification.referenceId, verified_at: new Date(), failure_code: null } });
      if (changed.count !== 1) throw new ConflictException("Payment changed while it was being settled");
      await tx.checkout_payment_groups.update({ where: { id: group.id }, data: { status: "paid" } });
      for (const { order } of current.orders) {
        const orderChanged = await tx.orders.updateMany({ where: { id: order.id, status: "pending" }, data: { status: "paid" } });
        if (orderChanged.count !== 1) throw new ConflictException("Order changed while payment was being settled");
        await tx.inventory_reservations.updateMany({ where: { order_item: { order_id: order.id }, status: "active" }, data: { status: "committed" } });
        const entitlements = order.items.filter((item) => item.digital_delivery_url && item.digital_max_downloads !== null);
        if (entitlements.length) {
          await tx.digital_entitlements.createMany({
            data: entitlements.map((item) => ({ order_item_id: item.id, buyer_id: order.buyer_id, delivery_url: item.digital_delivery_url!, max_downloads: item.digital_max_downloads! })),
            skipDuplicates: true
          });
        }
        await tx.order_events.create({
          data: { order_id: order.id, actor_user_id: order.buyer_id, from_status: "pending", to_status: "paid", idempotency_key: randomUUID(), request_hash: this.hash({ authority, referenceId: verification.referenceId, paymentGroupId: group.id }) }
        });
        await tx.outbox_events.create({
          data: { aggregate: "order", aggregate_id: order.id, event_type: "order.paid", dedupe_key: `order.paid:${order.id}`, payload: { orderId: order.id, buyerId: order.buyer_id, sellerId: order.seller_id, checkoutId: group.checkout_id, status: "paid" } }
        });
      }
      const unpaid = await tx.checkout_payment_groups.count({ where: { checkout_id: current.checkout_id, status: { not: "paid" } } });
      await tx.checkouts.update({ where: { id: current.checkout_id }, data: { status: unpaid === 0 ? "paid" : "partially_paid" } });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return { checkoutId: group.checkout_id, paymentGroupId: group.id, authority, referenceId: verification.referenceId, status: "succeeded" };
  }

  async reconcileCheckoutAttempt(attemptId: string) {
    const attempt = await this.prisma.payment_attempts.findFirst({
      where: { id: attemptId, checkout_payment_group_id: { not: null }, status: "pending", authority: { not: null } },
      select: { id: true, provider: true, authority: true, amount: true }
    });
    if (!attempt?.authority) return;
    const adapter = this.payments.get(attempt.provider);
    if (!adapter.inquiry) return;
    const paid = await adapter.inquiry(attempt.authority, attempt.amount.toString());
    if (paid) {
      await this.callbackCheckoutGroup(attempt.id, attempt.provider, attempt.authority, "OK");
      return;
    }
    await this.prisma.payment_attempts.updateMany({
      where: { id: attempt.id, status: "pending" },
      data: { status: "failed", failure_code: "STALE_UNPAID" }
    });
  }

  async refund(actor: AppUser, attemptId: string, reason: string, idempotencyKey: string) {
    const normalizedReason = reason.trim();
    const requestHash = this.hash({ attemptId, reason: normalizedReason });
    const claim = await this.prisma.$transaction(async (transaction) => {
      const attempt = await transaction.payment_attempts.findUnique({
        where: { id: attemptId },
        select: {
          id: true,
          provider: true,
          status: true,
          authority: true,
          amount: true,
          refund: true,
          order: {
            select: {
              id: true,
              buyer_id: true,
              seller_id: true,
              status: true,
              items: {
                select: {
                  bridge_fulfillment: { select: { id: true, status: true } }
                },
                take: 1
              }
            }
          }
        }
      });
      if (!attempt || !attempt.authority) {
        throw new ConflictException("Payment is not eligible for a refund");
      }
      if (attempt.refund) {
        if (attempt.refund.idempotency_key !== idempotencyKey || attempt.refund.request_hash !== requestHash) {
          throw new ConflictException("This payment already has a different refund operation");
        }
        return {
          kind: attempt.refund.status === "succeeded"
            ? "replay" as const
            : attempt.refund.status === "processing" && attempt.refund.provider_ref_id
              ? "finalize" as const
              : attempt.refund.status === "processing"
                ? "processing" as const
                : "unknown" as const,
          attempt,
          refundId: attempt.refund.id,
          providerRefundId: attempt.refund.provider_ref_id
        };
      }
      if (attempt.status !== "succeeded") {
        throw new ConflictException("Payment is not eligible for a refund");
      }
      if (!["paid", "processing", "shipped", "awaiting_confirmation"].includes(attempt.order.status)) {
        throw new ConflictException("The order is not eligible for a refund");
      }
      const fulfillment = attempt.order.items[0]?.bridge_fulfillment;
      if (fulfillment && !["waiting_payment", "queued", "failed", "manual_required", "refund_requested"].includes(fulfillment.status)) {
        throw new ConflictException("Fulfillment has reached the provider and requires manual dispute review");
      }

      const paymentChanged = await transaction.payment_attempts.updateMany({
        where: { id: attempt.id, status: "succeeded" },
        data: { status: "refund_pending", failure_code: null }
      });
      if (paymentChanged.count !== 1) throw new ConflictException("Payment changed; reload and try again");
      if (fulfillment) {
        const fulfillmentChanged = await transaction.bridge_fulfillments.updateMany({
          where: { id: fulfillment.id, status: fulfillment.status },
          data: {
            status: "refund_requested",
            next_attempt_at: null,
            locked_at: null,
            locked_by: null,
            last_error_code: "PAYMENT_REFUND_PENDING"
          }
        });
        if (fulfillmentChanged.count !== 1) throw new ConflictException("Fulfillment changed; reload and try again");
      }
      const orderChanged = await transaction.orders.updateMany({
        where: { id: attempt.order.id, status: attempt.order.status },
        data: { status: "cancelled" }
      });
      if (orderChanged.count !== 1) throw new ConflictException("Order changed; reload and try again");
      const refund = await transaction.payment_refunds.create({
        data: {
          payment_attempt_id: attempt.id,
          provider: attempt.provider,
          actor_user_id: actor.id,
          idempotency_key: idempotencyKey,
          request_hash: requestHash
        }
      });
      await transaction.order_events.create({
        data: {
          order_id: attempt.order.id,
          actor_user_id: actor.id,
          from_status: attempt.order.status,
          to_status: "cancelled",
          idempotency_key: idempotencyKey,
          request_hash: requestHash
        }
      });
      await transaction.outbox_events.create({
        data: {
          aggregate: "payment",
          aggregate_id: attempt.id,
          event_type: "payment.refund.started",
          dedupe_key: `payment.refund.started:${refund.id}`,
          payload: { orderId: attempt.order.id, paymentAttemptId: attempt.id, refundId: refund.id }
        }
      });
      return { kind: "claimed" as const, attempt, refundId: refund.id, providerRefundId: null };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });

    if (claim.kind === "replay") return { refunded: true };
    if (claim.kind === "finalize" && claim.providerRefundId) {
      return this.finalizeRefund(claim.attempt.id, claim.attempt.order.id, claim.refundId, claim.providerRefundId);
    }
    if (claim.kind === "processing") throw new ConflictException("Refund is already in progress");
    if (claim.kind === "unknown") {
      throw new ConflictException("Refund has an ambiguous provider outcome and requires reconciliation");
    }

    let providerResult;
    try {
      providerResult = await this.payments.get(claim.attempt.provider).refund({
        operationId: claim.refundId,
        providerReferenceId: claim.attempt.authority!,
        amount: claim.attempt.amount.toString(),
        reason: normalizedReason
      });
    } catch (error) {
      await this.markRefundUnknown(claim.attempt.id, claim.refundId, error);
      throw error;
    }
    if (!providerResult) {
      await this.markRefundUnknown(claim.attempt.id, claim.refundId, new Error("Provider refund was not confirmed"));
      throw new ConflictException("The payment provider did not confirm the refund");
    }
    await this.prisma.payment_refunds.updateMany({
      where: { id: claim.refundId, status: "processing", provider_ref_id: null },
      data: { provider_ref_id: providerResult.providerRefundId, failure_code: null }
    });
    return this.finalizeRefund(claim.attempt.id, claim.attempt.order.id, claim.refundId, providerResult.providerRefundId);
  }

  async listMethods(): Promise<AdminPaymentMethod[]> {
    const providers = await this.payments.listProviders();
    const configs = await this.prisma.payment_method_configs.findMany({
      where: { provider_code: { in: providers.map((provider) => provider.code) } },
      select: {
        provider_code: true,
        enabled: true,
        product_type_rules: { select: { product_type: true } },
        seller_rules: {
          select: { seller: { select: { id: true, shop_name: true } } },
          orderBy: { seller: { shop_name: "asc" } }
        }
      }
    });
    const configByProvider = new Map(configs.map((config) => [config.provider_code, config]));

    return providers.map((provider) => {
      const config = configByProvider.get(provider.code);
      return {
        code: provider.code,
        name: provider.name,
        adapterAvailable: provider.available,
        unavailabilityReason: provider.unavailabilityReason,
        enabled: config?.enabled ?? false,
        currencies: provider.currencies,
        supportsRefunds: provider.supportsRefunds,
        configuration: provider.configuration,
        allowedProductTypes: (config?.product_type_rules.map((rule) => rule.product_type) ?? []) as ProductType[],
        allowedSellers: config?.seller_rules.map((rule) => ({
          id: rule.seller.id,
          shopName: rule.seller.shop_name
        })) ?? []
      };
    });
  }

  async updateMethod(
    providerCode: string,
    input: {
      enabled: boolean;
      productTypes: ProductType[];
      sellerIds: string[];
      credentials?: PaymentCredentialInput;
    },
    actorId: string
  ): Promise<AdminPaymentMethod> {
    const adapter = this.payments.get(providerCode);
    if (input.credentials?.refundAccessToken && input.credentials.clearRefundAccessToken) {
      throw new BadRequestException("Choose either a new refund token or removal, not both");
    }
    const credentialUpdate = await this.credentials.prepareUpdate(adapter.providerCode, input.credentials);
    const adapterAvailability = adapter.providerCode === "zarinpal"
      ? { available: credentialUpdate.reason === null }
      : await adapter.availability();
    if (input.enabled && !adapterAvailability.available) {
      throw new BadRequestException("This payment method must be configured before it can be enabled");
    }
    const sellerCount = await this.prisma.sellers.count({ where: { id: { in: input.sellerIds } } });
    if (sellerCount !== input.sellerIds.length) {
      throw new BadRequestException("One or more selected sellers do not exist");
    }

    await this.prisma.$transaction(async (transaction) => {
      await transaction.payment_method_configs.upsert({
        where: { provider_code: adapter.providerCode },
        create: {
          provider_code: adapter.providerCode,
          enabled: input.enabled,
          ...credentialUpdate.data
        },
        update: { enabled: input.enabled, ...credentialUpdate.data }
      });
      await transaction.payment_method_seller_rules.deleteMany({
        where: { provider_code: adapter.providerCode }
      });
      await transaction.payment_method_product_type_rules.deleteMany({
        where: { provider_code: adapter.providerCode }
      });
      if (input.sellerIds.length) {
        await transaction.payment_method_seller_rules.createMany({
          data: input.sellerIds.map((sellerId) => ({ provider_code: adapter.providerCode, seller_id: sellerId }))
        });
      }
      if (input.productTypes.length) {
        await transaction.payment_method_product_type_rules.createMany({
          data: input.productTypes.map((productType) => ({ provider_code: adapter.providerCode, product_type: productType }))
        });
      }
      await transaction.payment_method_config_events.create({
        data: {
          provider_code: adapter.providerCode,
          actor_user_id: actorId,
          enabled: input.enabled,
          changed_fields: [
            "enabled",
            "productTypes",
            "sellerIds",
            ...(input.credentials?.merchantId?.trim() ? ["credentials.merchantId"] : []),
            ...(input.credentials?.callbackUrl?.trim() ? ["credentials.callbackUrl"] : []),
            ...(input.credentials?.refundAccessToken?.trim() ? ["credentials.refundAccessToken"] : []),
            ...(input.credentials?.clearRefundAccessToken ? ["credentials.refundAccessTokenRemoved"] : [])
          ]
        }
      });
    });

    const updated = (await this.listMethods()).find((method) => method.code === adapter.providerCode);
    if (!updated) throw new NotFoundException("Payment method was not found");
    return updated;
  }

  async listSellerOptions(query: string | undefined, limit: number): Promise<AdminPaymentSellerOption[]> {
    const sellers = await this.prisma.sellers.findMany({
      where: {
        approved: true,
        suspended_at: null,
        ...(query?.trim() ? { shop_name: { contains: query.trim(), mode: "insensitive" } } : {})
      },
      orderBy: [{ shop_name: "asc" }, { id: "asc" }],
      take: limit,
      select: { id: true, shop_name: true }
    });
    return sellers.map((seller) => ({ id: seller.id, shopName: seller.shop_name }));
  }

  async listTransactions(input: {
    limit: number;
    cursor?: string;
    status?: PaymentTransactionStatus;
    providerCode?: string;
    sellerId?: string;
    query?: string;
    from?: string;
    to?: string;
  }): Promise<AdminPaymentTransactionsPage> {
    if (input.from && input.to && input.from > input.to) {
      throw new BadRequestException("The start date must not be after the end date");
    }
    const query = input.query?.trim();
    const where = {
      ...(input.status ? { status: input.status } : {}),
      ...(input.providerCode ? { provider: input.providerCode } : {}),
      ...(input.sellerId ? { order: { is: { seller_id: input.sellerId } } } : {}),
      ...(query ? {
        OR: [
          { id: query },
          { order_id: query },
          { authority: query },
          { provider_ref_id: query }
        ]
      } : {}),
      ...(input.from || input.to ? {
        created_at: {
          ...(input.from ? { gte: new Date(`${input.from}T00:00:00.000Z`) } : {}),
          ...(input.to ? { lt: dayAfterUtc(input.to) } : {})
        }
      } : {})
    } satisfies Prisma.payment_attemptsWhereInput;

    const [transactions, total] = await Promise.all([
      this.prisma.payment_attempts.findMany({
      where,
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      take: input.limit + 1,
      select: {
        id: true,
        order_id: true,
        provider: true,
        status: true,
        amount: true,
        currency: true,
        authority: true,
        provider_ref_id: true,
        failure_code: true,
        verified_at: true,
        refunded_at: true,
        created_at: true,
        updated_at: true,
        order: {
          select: {
            buyer: { select: { id: true, full_name: true, email: true } },
            seller: { select: { id: true, shop_name: true } }
          }
        }
      }
    }),
      this.prisma.payment_attempts.count({ where })
    ]);
    const hasMore = transactions.length > input.limit;
    const page = hasMore ? transactions.slice(0, input.limit) : transactions;

    return {
      items: page.map((transaction) => ({
        id: transaction.id,
        orderId: transaction.order_id,
        provider: transaction.provider,
        status: transaction.status as PaymentTransactionStatus,
        amount: transaction.amount.toString(),
        currency: transaction.currency.trim(),
        authority: transaction.authority,
        providerReferenceId: transaction.provider_ref_id,
        failureCode: transaction.failure_code,
        buyer: {
          id: transaction.order.buyer.id,
          fullName: transaction.order.buyer.full_name,
          email: transaction.order.buyer.email
        },
        seller: {
          id: transaction.order.seller.id,
          shopName: transaction.order.seller.shop_name
        },
        verifiedAt: transaction.verified_at?.toISOString() ?? null,
        refundedAt: transaction.refunded_at?.toISOString() ?? null,
        createdAt: transaction.created_at.toISOString(),
        updatedAt: transaction.updated_at.toISOString()
      })),
      nextCursor: hasMore ? page.at(-1)?.id ?? null : null,
      total
    };
  }

  private async markInitiationUnknown(attemptId: string, error: unknown) {
    await this.prisma.payment_attempts.updateMany({
      where: { id: attemptId, status: "initiating" },
      data: { status: "initiation_unknown", failure_code: this.errorCode(error) }
    });
  }

  private async markRefundUnknown(attemptId: string, refundId: string, error: unknown) {
    const failureCode = this.errorCode(error);
    await this.prisma.$transaction([
      this.prisma.payment_attempts.updateMany({
        where: { id: attemptId, status: "refund_pending" },
        data: { status: "refund_unknown", failure_code: failureCode }
      }),
      this.prisma.payment_refunds.updateMany({
        where: { id: refundId, status: "processing" },
        data: { status: "unknown", failure_code: failureCode }
      })
    ]);
  }

  private async finalizeRefund(attemptId: string, orderId: string, refundId: string, providerRefundId: string) {
    await this.prisma.$transaction(async (transaction) => {
      const refund = await transaction.payment_refunds.findUniqueOrThrow({ where: { id: refundId } });
      if (refund.status === "succeeded") return;
      if (refund.status !== "processing" || refund.provider_ref_id !== providerRefundId) {
        throw new ConflictException("Refund cannot be finalized from its current state");
      }
      const paymentChanged = await transaction.payment_attempts.updateMany({
        where: { id: attemptId, status: "refund_pending" },
        data: { status: "refunded", refunded_at: new Date(), failure_code: null }
      });
      if (paymentChanged.count !== 1) throw new ConflictException("Payment changed before the refund was finalized");
      const refundChanged = await transaction.payment_refunds.updateMany({
        where: { id: refundId, status: "processing", provider_ref_id: providerRefundId },
        data: { status: "succeeded", completed_at: new Date(), failure_code: null }
      });
      if (refundChanged.count !== 1) throw new ConflictException("Refund changed before it was finalized");
      await transaction.bridge_fulfillments.updateMany({
        where: { order_item: { order_id: orderId }, status: "refund_requested" },
        data: {
          status: "refunded",
          completed_at: new Date(),
          next_attempt_at: null,
          locked_at: null,
          locked_by: null,
          last_error_code: null
        }
      });
      await transaction.outbox_events.create({
        data: {
          aggregate: "payment",
          aggregate_id: attemptId,
          event_type: "payment.refunded",
          dedupe_key: `payment.refunded:${refundId}`,
          payload: { orderId, paymentAttemptId: attemptId, refundId, providerRefundId }
        }
      });
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return { refunded: true };
  }

  private result(orderId: string, provider: string, authority: string, referenceId: string | null, status: "pending" | "succeeded" | "failed" | "refunded") {
    return {
      orderId,
      authority,
      referenceId,
      status,
      paymentUrl: status === "pending" ? this.payments.get(provider).paymentUrl(authority) : undefined
    };
  }

  private async assertMethodAllowed(providerCode: string, sellerId: string, productType: ProductType) {
    const config = await this.prisma.payment_method_configs.findFirst({
      where: {
        provider_code: providerCode,
        enabled: true,
        AND: [
          { OR: [{ seller_rules: { none: {} } }, { seller_rules: { some: { seller_id: sellerId } } }] },
          { OR: [{ product_type_rules: { none: {} } }, { product_type_rules: { some: { product_type: productType } } }] }
        ]
      },
      select: { provider_code: true }
    });
    if (!config) throw new BadRequestException("This payment method is not available for the order");
  }

  private hash(value: unknown) {
    return createHash("sha256").update(JSON.stringify(value)).digest("hex");
  }

  private errorCode(error: unknown) {
    return (error instanceof Error ? error.constructor.name : "PaymentProviderError")
      .replace(/[^A-Za-z0-9_]/g, "_")
      .slice(0, 64)
      .toUpperCase();
  }
}

function dayAfterUtc(value: string) {
  const date = new Date(`${value}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date;
}
