import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import type { AppUser } from "@topgsm/shared-types";
import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "../../prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { ShippingProviderRegistry } from "./shipping-provider.registry";
import { ShippingTenantService } from "./shipping-tenant.service";

const REGISTRATION_LEASE_MS = 60_000;

@Injectable()
export class ShippingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenants: ShippingTenantService,
    private readonly providers: ShippingProviderRegistry
  ) {}

  async register(actor: AppUser, orderId: string, idempotencyKey: string) {
    const sellerId = await this.sellerIdFor(actor);
    const provider = this.providers.active();
    const requestHash = this.hash({ action: "shipping_register", provider: provider.code, orderId });
    const existingKey = await this.prisma.shipping_dispatches.findFirst({
      where: { idempotency_key: idempotencyKey, order: { seller_id: sellerId } }
    });
    if (existingKey) {
      this.assertSameRequest(existingKey.request_hash, requestHash);
      return this.map(existingKey);
    }

    const order = await this.prisma.orders.findFirst({
      where: { id: orderId, seller_id: sellerId, status: "processing", items: { every: { product_type: "physical" }, some: { product_type: "physical" } } },
      select: {
        id: true,
        currency: true,
        total_amount: true,
        shipping_address: { select: { recipient_name: true, phone_number: true, province: true, city: true, postal_code: true, address_line: true } },
        items: { select: { product_title: true, quantity: true, offer: { select: { physical: { select: { weight_grams: true } } } } } }
      }
    });
    if (!order) throw new NotFoundException("A processing physical order was not found");
    if (!order.shipping_address) throw new ConflictException("The order has no shipping address");

    const { tenantState, origin } = await this.tenants.effectiveForSeller(sellerId);
    const dispatch = await this.claim(sellerId, order.id, provider.code, idempotencyKey, requestHash);
    if (dispatch.status === "registered" || dispatch.status === "tracking_available") return this.map(dispatch);

    try {
      if (dispatch.attempt_count > 1) {
        const reconciled = await provider.findTracking({
          tenantState,
          recipientMobile: order.shipping_address.phone_number,
          dispatchId: dispatch.id
        });
        if (reconciled) return this.map(await this.recordRegistration(dispatch.id, dispatch.claim_token, reconciled, dispatch.registered_at));
      }
      const result = await provider.createShipment({
        origin,
        tenantState,
        order: {
          dispatchId: dispatch.id,
          recipientName: order.shipping_address.recipient_name,
          recipientMobile: order.shipping_address.phone_number,
          recipientProvince: order.shipping_address.province,
          recipientCity: order.shipping_address.city,
          recipientAddress: order.shipping_address.address_line,
          recipientPostalCode: order.shipping_address.postal_code.trim(),
          currency: order.currency.trim(),
          totalAmount: order.total_amount.toString(),
          items: order.items.map((item) => ({
            title: item.product_title,
            quantity: item.quantity,
            weightGrams: item.offer.physical?.weight_grams ?? 0
          }))
        }
      });
      return this.map(await this.completeRegistration(dispatch.id, dispatch.claim_token, result.providerOrderReference));
    } catch (error) {
      await this.prisma.shipping_dispatches.updateMany({
        where: { id: dispatch.id, status: "registering", claim_token: dispatch.claim_token },
        data: { status: "failed", claim_token: null, last_error_code: this.errorCode(error) }
      });
      throw error;
    }
  }

  async sync(actor: AppUser, orderId: string, idempotencyKey: string) {
    const sellerId = await this.sellerIdFor(actor);
    const dispatch = await this.prisma.shipping_dispatches.findFirst({
      where: { order_id: orderId, order: { seller_id: sellerId } },
      select: {
        id: true, order_id: true, provider: true, status: true, provider_order_reference: true,
        legacy_provider_order_id: true, provider_tracking_code: true, courier_tracking_code: true,
        courier_title: true, idempotency_key: true, request_hash: true, attempt_count: true,
        last_error_code: true, last_attempted_at: true, registered_at: true, tracking_synced_at: true,
        created_at: true, updated_at: true,
        order: { select: { status: true, buyer_id: true, seller_id: true, shipping_address: { select: { phone_number: true } } } }
      }
    });
    if (!dispatch) throw new NotFoundException("Shipping dispatch was not found");
    if (dispatch.status === "registering" || dispatch.status === "failed" || !dispatch.order.shipping_address) {
      throw new ConflictException("The shipping dispatch is not registered");
    }
    if (dispatch.status === "tracking_available") return this.map(dispatch);

    const { provider, tenantState } = await this.tenants.effectiveForSeller(sellerId, dispatch.provider);
    const tracking = await provider.findTracking({
      tenantState,
      recipientMobile: dispatch.order.shipping_address.phone_number,
      dispatchId: dispatch.id
    });
    if (!tracking?.courierTrackingCode && !tracking?.providerTrackingCode) return this.map(dispatch);

    return this.prisma.$transaction(async (tx) => {
      const current = await tx.shipping_dispatches.findUniqueOrThrow({
        where: { id: dispatch.id },
        include: { order: { select: { status: true, buyer_id: true, seller_id: true } } }
      });
      if (current.order.seller_id !== sellerId) throw new NotFoundException("Shipping dispatch was not found");
      if (current.status === "tracking_available") return this.map(current);
      if (current.order.status !== "processing" && current.order.status !== "shipped") throw new ConflictException("The order cannot be marked as shipped");
      if (current.order.status === "processing") {
        const changed = await tx.orders.updateMany({ where: { id: orderId, seller_id: sellerId, status: "processing" }, data: { status: "shipped" } });
        if (changed.count !== 1) throw new ConflictException("Order changed before shipping tracking was recorded");
        const requestHash = this.hash({ action: "shipping_sync", provider: dispatch.provider, orderId });
        const replay = await tx.order_events.findUnique({ where: { actor_user_id_idempotency_key: { actor_user_id: actor.id, idempotency_key: idempotencyKey } } });
        if (replay) this.assertSameRequest(replay.request_hash, requestHash);
        else await tx.order_events.create({ data: { order_id: orderId, actor_user_id: actor.id, from_status: "processing", to_status: "shipped", idempotency_key: idempotencyKey, request_hash: requestHash } });
        await tx.outbox_events.upsert({
          where: { dedupe_key: `order.shipping-shipped:${orderId}` },
          create: { aggregate: "order", aggregate_id: orderId, event_type: "order.status.updated", dedupe_key: `order.shipping-shipped:${orderId}`, payload: { orderId, buyerId: current.order.buyer_id, sellerId: current.order.seller_id, fromStatus: "processing", status: "shipped" } },
          update: {}
        });
      }
      await tx.order_shipments.upsert({
        where: { order_id: orderId },
        create: { order_id: orderId, carrier: tracking.courierTitle || provider.displayName, tracking_code: tracking.courierTrackingCode || tracking.providerTrackingCode },
        update: { carrier: tracking.courierTitle || provider.displayName, tracking_code: tracking.courierTrackingCode || tracking.providerTrackingCode, shipped_at: new Date() }
      });
      return this.map(await tx.shipping_dispatches.update({
        where: { id: dispatch.id },
        data: { status: "tracking_available", provider_tracking_code: tracking.providerTrackingCode, courier_tracking_code: tracking.courierTrackingCode, courier_title: tracking.courierTitle, tracking_synced_at: new Date(), last_error_code: null }
      }));
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private async claim(sellerId: string, orderId: string, provider: string, idempotencyKey: string, requestHash: string) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.shipping_dispatches.findUnique({ where: { order_id: orderId } });
        const claimToken = randomUUID();
        if (!existing) return tx.shipping_dispatches.create({
          data: { order_id: orderId, provider, status: "registering", claim_token: claimToken, idempotency_key: idempotencyKey, request_hash: requestHash, attempt_count: 1, last_attempted_at: new Date() }
        });
        if (existing.status === "registered" || existing.status === "tracking_available") {
          if (existing.provider !== provider) throw new ConflictException(`The order is already registered with ${existing.provider}`);
          return existing;
        }
        if (existing.status === "registering" && existing.last_attempted_at.getTime() > Date.now() - REGISTRATION_LEASE_MS) {
          throw new ConflictException("Shipping registration is already in progress");
        }
        return tx.shipping_dispatches.update({
          where: { id: existing.id },
          data: {
            provider,
            status: "registering",
            claim_token: claimToken,
            idempotency_key: idempotencyKey,
            request_hash: requestHash,
            provider_order_reference: existing.provider === provider ? existing.provider_order_reference : null,
            provider_tracking_code: existing.provider === provider ? existing.provider_tracking_code : null,
            courier_tracking_code: existing.provider === provider ? existing.courier_tracking_code : null,
            courier_title: existing.provider === provider ? existing.courier_title : null,
            attempt_count: { increment: 1 },
            last_attempted_at: new Date(),
            last_error_code: null
          }
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
      const replay = await this.prisma.shipping_dispatches.findFirst({
        where: { order: { seller_id: sellerId }, OR: [{ idempotency_key: idempotencyKey }, { order_id: orderId }] }
      });
      if (!replay) throw new ConflictException("Idempotency-Key is already in use");
      if (replay.idempotency_key === idempotencyKey) this.assertSameRequest(replay.request_hash, requestHash);
      if (replay.status === "registered" || replay.status === "tracking_available") return replay;
      throw new ConflictException("Shipping registration is already in progress");
    }
  }

  private async recordRegistration(id: number, claimToken: string | null, tracking: { providerTrackingCode: string | null; courierTrackingCode: string | null; courierTitle: string | null }, registeredAt: Date | null) {
    const changed = await this.prisma.shipping_dispatches.updateMany({
      where: { id, status: "registering", claim_token: claimToken },
      data: {
        status: "registered",
        claim_token: null,
        provider_tracking_code: tracking.providerTrackingCode,
        courier_tracking_code: tracking.courierTrackingCode,
        courier_title: tracking.courierTitle,
        registered_at: registeredAt ?? new Date(),
        last_error_code: null
      }
    });
    if (changed.count !== 1) throw new ConflictException("Shipping registration lease was lost");
    return this.prisma.shipping_dispatches.findUniqueOrThrow({ where: { id } });
  }

  private async completeRegistration(id: number, claimToken: string | null, providerOrderReference: string) {
    const changed = await this.prisma.shipping_dispatches.updateMany({
      where: { id, status: "registering", claim_token: claimToken },
      data: { status: "registered", claim_token: null, provider_order_reference: providerOrderReference, registered_at: new Date(), last_error_code: null }
    });
    if (changed.count !== 1) throw new ConflictException("Shipping registration lease was lost");
    return this.prisma.shipping_dispatches.findUniqueOrThrow({ where: { id } });
  }

  private async sellerIdFor(actor: AppUser) {
    if (actor.role !== "seller-admin" && actor.role !== "seller-staff") throw new ForbiddenException("Seller access is required");
    const membership = await this.prisma.seller_memberships.findFirst({
      where: { user_id: actor.id, active: true, seller: { invited: false, approved: true, suspended_at: null, permissions: { some: { permission: "orders_manage" } } } },
      select: { seller_id: true }
    });
    if (!membership) throw new ForbiddenException("Active seller orders_manage permission is required");
    return membership.seller_id;
  }

  private assertSameRequest(stored: string, incoming: string) {
    if (stored.trim() !== incoming) throw new ConflictException("Idempotency-Key was already used for another request");
  }

  private hash(value: unknown) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
  private errorCode(error: unknown) {
    return error instanceof UnprocessableEntityException ? "ADDRESS_UNSUPPORTED" : error instanceof BadRequestException ? "REQUEST_INVALID" : "PROVIDER_UNAVAILABLE";
  }

  private map(dispatch: {
    id: number; provider: string; status: string; provider_order_reference: string | null; legacy_provider_order_id: number | null;
    provider_tracking_code: string | null; courier_tracking_code: string | null; courier_title: string | null;
    last_error_code: string | null; registered_at: Date | null; tracking_synced_at: Date | null;
  }) {
    return {
      externalOrderId: dispatch.id,
      provider: dispatch.provider,
      providerOrderReference: dispatch.provider_order_reference ?? (dispatch.legacy_provider_order_id ? String(dispatch.legacy_provider_order_id) : null),
      status: dispatch.status,
      providerTrackingCode: dispatch.provider_tracking_code,
      courierTrackingCode: dispatch.courier_tracking_code,
      courierTitle: dispatch.courier_title,
      errorCode: dispatch.last_error_code,
      registeredAt: dispatch.registered_at?.toISOString() ?? null,
      trackingSyncedAt: dispatch.tracking_synced_at?.toISOString() ?? null
    };
  }
}
