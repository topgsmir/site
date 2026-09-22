import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import type { AppUser } from "@topgsm/shared-types";
import { Prisma } from "../../prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { OrderService } from "./order.service";

const detailsSelect = {
  buyer_id: true, seller_id: true, checkout_id: true,
  buyer: { select: { id: true, full_name: true, username: true, email: true, phone_number: true, role: true, created_at: true, updated_at: true } },
  seller: { select: { id: true, shop_name: true, phone_number: true, invited: true, approved: true,
    suspended_at: true, created_at: true, updated_at: true,
    user: { select: { id: true, full_name: true, email: true, phone_number: true } } } },
  shipping_address: { select: { created_at: true } },
  shipment: { select: { updated_at: true } },
  amadast_shipment: { select: {
    id: true, status: true, provider_order_id: true, amadast_tracking_code: true,
    courier_tracking_code: true, courier_title: true, attempt_count: true,
    last_error_code: true, last_attempted_at: true, registered_at: true,
    tracking_synced_at: true, created_at: true, updated_at: true
  } },
  items: { select: {
    id: true, inventory_reservation: { select: {
      id: true, offer_id: true, quantity: true, status: true, expires_at: true, created_at: true, updated_at: true
    } }, digital_entitlement: { orderBy: { file_index: "asc" }, select: {
      id: true, buyer_id: true, max_downloads: true, download_count: true, last_accessed_at: true, created_at: true
    } }, bridge_fulfillment: { select: {
      id: true, grant_id: true, status: true, mode: true, provider_reference: true,
      submit_attempts: true, manual_retry_count: true, next_attempt_at: true,
      last_error_code: true, submitted_at: true, completed_at: true, created_at: true, updated_at: true,
      grant: { select: { service: { select: { name: true, external_service_id: true } } } },
      attempts: { orderBy: { created_at: "desc" }, select: {
        id: true, action: true, outcome: true, error_code: true, created_at: true
      } }
    } }
  } },
  events: { orderBy: { created_at: "desc" }, select: {
    id: true, from_status: true, to_status: true, created_at: true,
    actor: { select: { id: true, full_name: true, email: true } }
  } },
  payout_records: { select: {
    id: true, gross_amount: true, commission_amount: true, holdback_amount: true,
    payable_amount: true, currency: true, status: true, requested_at: true,
    approved_at: true, settled_at: true, created_at: true, updated_at: true,
    events: { orderBy: { created_at: "desc" }, select: {
      id: true, from_status: true, to_status: true, created_at: true,
      actor: { select: { id: true, full_name: true } }
    } }
  } },
  payment_attempts: { orderBy: { created_at: "desc" }, select: {
    id: true, checkout_payment_group_id: true, provider: true, status: true,
    amount: true, currency: true, failure_code: true, verified_at: true,
    refunded_at: true, initiation_started_at: true, created_at: true, updated_at: true,
    refund: { select: {
      id: true, status: true, provider: true, failure_code: true, provider_ref_id: true,
      created_at: true, updated_at: true, completed_at: true,
      actor: { select: { id: true, full_name: true } }
    } }
  } },
  checkout: { select: {
    id: true, status: true, currency: true, total_amount: true,
    expires_at: true, created_at: true, updated_at: true,
    payment_groups: { orderBy: { created_at: "desc" }, select: {
      id: true, provider: true, status: true, amount: true, currency: true,
      expires_at: true, created_at: true, updated_at: true
    } }
  } },
  payment_groups: { select: {
    amount: true, payment_group: { select: { id: true, provider: true, status: true } }
  } }
} satisfies Prisma.ordersSelect;

@Injectable()
export class AdminOrderDetailsService {
  constructor(private readonly prisma: PrismaService, private readonly orders: OrderService) {}

  async get(actor: AppUser, id: string) {
    if (actor.role !== "platform-admin" &&
        !(actor.role === "platform-staff" && actor.platformPermissions?.includes("orders_manage"))) {
      throw new ForbiddenException("Platform order access is required");
    }
    const order = await this.prisma.orders.findUnique({ where: { id }, select: detailsSelect });
    if (!order) throw new NotFoundException("Order was not found");
    const base = await this.orders.get(actor, id);
    const outbox = await this.prisma.outbox_events.findMany({
      where: { aggregate: "order", aggregate_id: id },
      orderBy: { created_at: "desc" },
      select: { id: true, event_type: true, created_at: true, published_at: true, attempts: true,
        deliveries: { select: { consumer: true, status: true, attempts: true, last_error: true, delivered_at: true } } }
    });
    return {
      ...base,
      buyerId: order.buyer_id, sellerId: order.seller_id, checkoutId: order.checkout_id,
      buyerProfile: { id: order.buyer.id, fullName: order.buyer.full_name,
        username: order.buyer.username, email: order.buyer.email,
        phoneNumber: order.buyer.phone_number, role: order.buyer.role,
        createdAt: order.buyer.created_at.toISOString(), updatedAt: order.buyer.updated_at.toISOString() },
      sellerProfile: { id: order.seller.id, shopName: order.seller.shop_name,
        phoneNumber: order.seller.phone_number, invited: order.seller.invited,
        approved: order.seller.approved, suspendedAt: order.seller.suspended_at?.toISOString() ?? null,
        createdAt: order.seller.created_at.toISOString(), updatedAt: order.seller.updated_at.toISOString(),
        owner: { id: order.seller.user.id, fullName: order.seller.user.full_name,
          email: order.seller.user.email, phoneNumber: order.seller.user.phone_number } },
      shippingAddressCreatedAt: order.shipping_address?.created_at.toISOString() ?? null,
      shipmentUpdatedAt: order.shipment?.updated_at.toISOString() ?? null,
      amadastShipment: order.amadast_shipment ? {
        id: order.amadast_shipment.id, status: order.amadast_shipment.status,
        providerOrderId: order.amadast_shipment.provider_order_id,
        amadastTrackingCode: order.amadast_shipment.amadast_tracking_code,
        courierTrackingCode: order.amadast_shipment.courier_tracking_code,
        courierTitle: order.amadast_shipment.courier_title,
        attemptCount: order.amadast_shipment.attempt_count,
        errorCode: order.amadast_shipment.last_error_code,
        lastAttemptedAt: order.amadast_shipment.last_attempted_at.toISOString(),
        registeredAt: order.amadast_shipment.registered_at?.toISOString() ?? null,
        trackingSyncedAt: order.amadast_shipment.tracking_synced_at?.toISOString() ?? null,
        createdAt: order.amadast_shipment.created_at.toISOString(),
        updatedAt: order.amadast_shipment.updated_at.toISOString()
      } : null,
      itemOperations: order.items.map((item) => ({
        itemId: item.id,
        inventory: item.inventory_reservation ? {
          id: item.inventory_reservation.id, offerId: item.inventory_reservation.offer_id,
          quantity: item.inventory_reservation.quantity, status: item.inventory_reservation.status,
          expiresAt: item.inventory_reservation.expires_at.toISOString(),
          createdAt: item.inventory_reservation.created_at.toISOString(),
          updatedAt: item.inventory_reservation.updated_at.toISOString()
        } : null,
        digital: item.digital_entitlement[0] ? {
          id: item.digital_entitlement[0].id, buyerId: item.digital_entitlement[0].buyer_id,
          maxDownloads: item.digital_entitlement[0].max_downloads,
          downloadCount: item.digital_entitlement[0].download_count,
          lastAccessedAt: item.digital_entitlement[0].last_accessed_at?.toISOString() ?? null,
          createdAt: item.digital_entitlement[0].created_at.toISOString()
        } : null,
        digitalFiles: item.digital_entitlement.map((file) => ({
          id: file.id, buyerId: file.buyer_id, maxDownloads: file.max_downloads,
          downloadCount: file.download_count, lastAccessedAt: file.last_accessed_at?.toISOString() ?? null,
          createdAt: file.created_at.toISOString()
        })),
        bridge: item.bridge_fulfillment ? {
          id: item.bridge_fulfillment.id, grantId: item.bridge_fulfillment.grant_id,
          service: item.bridge_fulfillment.grant.service.name,
          externalServiceId: item.bridge_fulfillment.grant.service.external_service_id,
          status: item.bridge_fulfillment.status, mode: item.bridge_fulfillment.mode,
          providerReference: item.bridge_fulfillment.provider_reference,
          submitAttempts: item.bridge_fulfillment.submit_attempts,
          manualRetryCount: item.bridge_fulfillment.manual_retry_count,
          nextAttemptAt: item.bridge_fulfillment.next_attempt_at?.toISOString() ?? null,
          errorCode: item.bridge_fulfillment.last_error_code,
          submittedAt: item.bridge_fulfillment.submitted_at?.toISOString() ?? null,
          completedAt: item.bridge_fulfillment.completed_at?.toISOString() ?? null,
          createdAt: item.bridge_fulfillment.created_at.toISOString(),
          updatedAt: item.bridge_fulfillment.updated_at.toISOString(),
          attempts: item.bridge_fulfillment.attempts.map((attempt) => ({
            id: attempt.id, action: attempt.action, outcome: attempt.outcome,
            errorCode: attempt.error_code, createdAt: attempt.created_at.toISOString()
          }))
        } : null
      })),
      history: order.events.map((event) => ({
        id: event.id, fromStatus: event.from_status, toStatus: event.to_status,
        at: event.created_at.toISOString(), actor: {
          id: event.actor.id, name: event.actor.full_name, email: event.actor.email
        }
      })),
      payouts: order.payout_records.map((payout) => ({
        id: payout.id, status: payout.status, currency: payout.currency.trim(),
        grossAmount: payout.gross_amount.toString(), commissionAmount: payout.commission_amount.toString(),
        holdbackAmount: payout.holdback_amount.toString(), payableAmount: payout.payable_amount.toString(),
        requestedAt: payout.requested_at?.toISOString() ?? null,
        approvedAt: payout.approved_at?.toISOString() ?? null,
        settledAt: payout.settled_at?.toISOString() ?? null,
        createdAt: payout.created_at.toISOString(), updatedAt: payout.updated_at.toISOString(),
        events: payout.events.map((event) => ({ id: event.id, fromStatus: event.from_status,
          toStatus: event.to_status, at: event.created_at.toISOString(),
          actor: { id: event.actor.id, name: event.actor.full_name } }))
      })),
      payments: order.payment_attempts.map((payment) => ({
        id: payment.id, groupId: payment.checkout_payment_group_id,
        provider: payment.provider, status: payment.status,
        amount: payment.amount.toString(), currency: payment.currency.trim(),
        failureCode: payment.failure_code,
        initiationStartedAt: payment.initiation_started_at?.toISOString() ?? null,
        verifiedAt: payment.verified_at?.toISOString() ?? null,
        refundedAt: payment.refunded_at?.toISOString() ?? null,
        createdAt: payment.created_at.toISOString(), updatedAt: payment.updated_at.toISOString(),
        refund: payment.refund ? {
          id: payment.refund.id, status: payment.refund.status,
          provider: payment.refund.provider, providerReference: payment.refund.provider_ref_id,
          failureCode: payment.refund.failure_code,
          createdAt: payment.refund.created_at.toISOString(),
          updatedAt: payment.refund.updated_at.toISOString(),
          completedAt: payment.refund.completed_at?.toISOString() ?? null,
          actor: { id: payment.refund.actor.id, name: payment.refund.actor.full_name }
        } : null
      })),
      checkout: order.checkout ? {
        id: order.checkout.id, status: order.checkout.status,
        currency: order.checkout.currency.trim(), totalAmount: order.checkout.total_amount.toString(),
        expiresAt: order.checkout.expires_at.toISOString(),
        createdAt: order.checkout.created_at.toISOString(), updatedAt: order.checkout.updated_at.toISOString(),
        groups: order.checkout.payment_groups.map((group) => ({
          id: group.id, provider: group.provider, status: group.status,
          amount: group.amount.toString(), currency: group.currency.trim(),
          expiresAt: group.expires_at.toISOString(),
          createdAt: group.created_at.toISOString(), updatedAt: group.updated_at.toISOString()
        }))
      } : null,
      paymentGroups: order.payment_groups.map((group) => ({
        id: group.payment_group.id, provider: group.payment_group.provider,
        status: group.payment_group.status, orderAmount: group.amount.toString()
      })),
      outbox: outbox.map((event) => ({
        id: event.id, type: event.event_type, createdAt: event.created_at.toISOString(),
        publishedAt: event.published_at?.toISOString() ?? null, attempts: event.attempts,
        deliveries: event.deliveries.map((delivery) => ({ consumer: delivery.consumer,
          status: delivery.status, attempts: delivery.attempts,
          lastError: delivery.last_error, deliveredAt: delivery.delivered_at?.toISOString() ?? null }))
      }))
    };
  }
}
