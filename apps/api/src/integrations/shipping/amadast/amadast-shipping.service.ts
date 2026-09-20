import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnprocessableEntityException } from "@nestjs/common";
import type { AppUser } from "@topgsm/shared-types";
import { createHash } from "node:crypto";
import { Prisma } from "../../../prisma/client";
import { PrismaService } from "../../../prisma/prisma.service";
import { AmadastAdapter } from "./amadast.adapter";
import { AmadastSettingsService } from "./amadast-settings.service";
import { SellerShippingProfileService } from "../seller-shipping-profile.service";

@Injectable()
export class AmadastShippingService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: AmadastSettingsService,
    private readonly profiles: SellerShippingProfileService,
    private readonly amadast: AmadastAdapter
  ) {}

  async register(actor: AppUser, orderId: string, idempotencyKey: string) {
    const sellerId = await this.sellerIdFor(actor);
    const config = await this.settings.effective();
    const sender = await this.profiles.effectiveSender(sellerId);
    const requestHash = this.hash({ action: "amadast_register", orderId });
    const existingKey = await this.prisma.amadast_shipments.findUnique({ where: { idempotency_key: idempotencyKey } });
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
    const providerValue = order.total_amount.mul(10);
    if (order.currency.trim() !== "TOMAN" || !providerValue.isInteger() || providerValue.lt(10_000) || providerValue.gt(2_147_483_647)) {
      throw new ConflictException("The order value is outside Amadast limits");
    }
    const weight = order.items.reduce((sum, item) => sum + (item.offer.physical?.weight_grams ?? 0) * item.quantity, 0);
    if (!Number.isSafeInteger(weight) || weight < 10) throw new ConflictException("Physical offer weights must total at least 10 grams");
    const recipientMobile = this.iranianMobile(order.shipping_address.phone_number);
    if (!recipientMobile) throw new ConflictException("The shipping phone number is invalid for Amadast");

    const dispatch = await this.claim(order.id, idempotencyKey, requestHash);
    if (dispatch.status === "registered" || dispatch.status === "tracking_available") return this.map(dispatch);

    try {
      if (dispatch.attempt_count > 1) {
        const reconciled = await this.amadast.findTracking(config, recipientMobile, dispatch.id);
        if (reconciled) {
          return this.map(await this.prisma.amadast_shipments.update({
            where: { id: dispatch.id },
            data: {
              status: "registered",
              amadast_tracking_code: reconciled.amadastTrackingCode,
              courier_tracking_code: reconciled.courierTrackingCode,
              courier_title: reconciled.courierTitle,
              registered_at: dispatch.registered_at ?? new Date(),
              last_error_code: null
            }
          }));
        }
      }
      const result = await this.amadast.createOrder(config, order.shipping_address.province, order.shipping_address.city, {
        store_id: config.storeId,
        external_order_id: dispatch.id,
        recipient_name: order.shipping_address.recipient_name,
        sender_name: sender.senderName,
        recipient_mobile: recipientMobile,
        sender_mobile: sender.senderMobile,
        recipient_address: order.shipping_address.address_line,
        weight,
        value: providerValue.toNumber(),
        product_type: config.productType,
        package_type: config.packageType,
        recipient_postal_code: order.shipping_address.postal_code.trim(),
        description: order.items.map((item) => `${item.product_title} × ${item.quantity}`).join("، ").slice(0, 500),
        is_breakable: false,
        is_liquid: false,
        is_big: false
      });
      return this.map(await this.prisma.amadast_shipments.update({
        where: { id: dispatch.id },
        data: { status: "registered", provider_order_id: result.providerOrderId, registered_at: new Date(), last_error_code: null }
      }));
    } catch (error) {
      await this.prisma.amadast_shipments.update({ where: { id: dispatch.id }, data: { status: "failed", last_error_code: this.errorCode(error) } });
      throw error;
    }
  }

  async sync(actor: AppUser, orderId: string, idempotencyKey: string) {
    const sellerId = await this.sellerIdFor(actor);
    const config = await this.settings.effective();
    const dispatch = await this.prisma.amadast_shipments.findFirst({
      where: { order_id: orderId, order: { seller_id: sellerId } },
      select: { id: true, order_id: true, status: true, provider_order_id: true, amadast_tracking_code: true, courier_tracking_code: true, courier_title: true, idempotency_key: true, request_hash: true, attempt_count: true, last_error_code: true, last_attempted_at: true, registered_at: true, tracking_synced_at: true, created_at: true, updated_at: true, order: { select: { status: true, buyer_id: true, seller_id: true, shipping_address: { select: { phone_number: true } } } } }
    });
    if (!dispatch) throw new NotFoundException("Amadast shipment was not found");
    if (dispatch.status === "registering" || dispatch.status === "failed" || !dispatch.order.shipping_address) throw new ConflictException("The Amadast shipment is not registered");
    if (dispatch.status === "tracking_available") return this.map(dispatch);
    const phone = this.iranianMobile(dispatch.order.shipping_address.phone_number);
    if (!phone) throw new ConflictException("The shipping phone number is invalid for Amadast");
    const tracking = await this.amadast.findTracking(config, phone, dispatch.id);
    if (!tracking?.courierTrackingCode && !tracking?.amadastTrackingCode) return this.map(dispatch);

    return this.prisma.$transaction(async (tx) => {
      const current = await tx.amadast_shipments.findUniqueOrThrow({ where: { id: dispatch.id }, include: { order: { select: { status: true, buyer_id: true, seller_id: true } } } });
      if (current.status === "tracking_available") return this.map(current);
      if (current.order.status !== "processing" && current.order.status !== "shipped") throw new ConflictException("The order cannot be marked as shipped");
      if (current.order.status === "processing") {
        const changed = await tx.orders.updateMany({ where: { id: orderId, seller_id: sellerId, status: "processing" }, data: { status: "shipped" } });
        if (changed.count !== 1) throw new ConflictException("Order changed before Amadast tracking was recorded");
        const requestHash = this.hash({ action: "amadast_sync", orderId });
        const replay = await tx.order_events.findUnique({ where: { actor_user_id_idempotency_key: { actor_user_id: actor.id, idempotency_key: idempotencyKey } } });
        if (replay) this.assertSameRequest(replay.request_hash, requestHash);
        else await tx.order_events.create({ data: { order_id: orderId, actor_user_id: actor.id, from_status: "processing", to_status: "shipped", idempotency_key: idempotencyKey, request_hash: requestHash } });
        await tx.outbox_events.upsert({
          where: { dedupe_key: `order.amadast-shipped:${orderId}` },
          create: { aggregate: "order", aggregate_id: orderId, event_type: "order.status.updated", dedupe_key: `order.amadast-shipped:${orderId}`, payload: { orderId, buyerId: current.order.buyer_id, sellerId: current.order.seller_id, fromStatus: "processing", status: "shipped" } },
          update: {}
        });
      }
      await tx.order_shipments.upsert({
        where: { order_id: orderId },
        create: { order_id: orderId, carrier: tracking.courierTitle || "Amadast", tracking_code: tracking.courierTrackingCode || tracking.amadastTrackingCode },
        update: { carrier: tracking.courierTitle || "Amadast", tracking_code: tracking.courierTrackingCode || tracking.amadastTrackingCode, shipped_at: new Date() }
      });
      return this.map(await tx.amadast_shipments.update({
        where: { id: dispatch.id },
        data: { status: "tracking_available", amadast_tracking_code: tracking.amadastTrackingCode, courier_tracking_code: tracking.courierTrackingCode, courier_title: tracking.courierTitle, tracking_synced_at: new Date(), last_error_code: null }
      }));
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private async claim(orderId: string, idempotencyKey: string, requestHash: string) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const existing = await tx.amadast_shipments.findUnique({ where: { order_id: orderId } });
        if (!existing) return tx.amadast_shipments.create({ data: { order_id: orderId, status: "registering", idempotency_key: idempotencyKey, request_hash: requestHash, attempt_count: 1, last_attempted_at: new Date() } });
        if (existing.status === "registered" || existing.status === "tracking_available") return existing;
        if (existing.status === "registering" && existing.last_attempted_at.getTime() > Date.now() - 60_000) throw new ConflictException("Amadast shipment registration is already in progress");
        return tx.amadast_shipments.update({
          where: { id: existing.id },
          data: { status: "registering", idempotency_key: idempotencyKey, request_hash: requestHash, attempt_count: { increment: 1 }, last_attempted_at: new Date(), last_error_code: null }
        });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (!(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") throw error;
      const replay = await this.prisma.amadast_shipments.findFirst({ where: { OR: [{ idempotency_key: idempotencyKey }, { order_id: orderId }] } });
      if (!replay) throw error;
      if (replay.idempotency_key === idempotencyKey) this.assertSameRequest(replay.request_hash, requestHash);
      if (replay.status === "registered" || replay.status === "tracking_available") return replay;
      throw new ConflictException("Amadast shipment registration is already in progress");
    }
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

  private iranianMobile(value: string | null | undefined) {
    const digits = value?.replace(/\D/g, "") ?? "";
    const normalized = digits.startsWith("0098") ? `0${digits.slice(4)}` : digits.startsWith("98") ? `0${digits.slice(2)}` : digits;
    return /^09\d{9}$/.test(normalized) ? normalized : null;
  }

  private assertSameRequest(stored: string, incoming: string) {
    if (stored.trim() !== incoming) throw new ConflictException("Idempotency-Key was already used for another request");
  }

  private hash(value: unknown) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
  private errorCode(error: unknown) { return error instanceof UnprocessableEntityException ? "ADDRESS_UNSUPPORTED" : error instanceof BadRequestException ? "REQUEST_INVALID" : "PROVIDER_UNAVAILABLE"; }
  private map(dispatch: { id: number; status: string; provider_order_id: number | null; amadast_tracking_code: string | null; courier_tracking_code: string | null; courier_title: string | null; last_error_code: string | null; registered_at: Date | null; tracking_synced_at: Date | null }) {
    return { externalOrderId: dispatch.id, status: dispatch.status, providerOrderId: dispatch.provider_order_id, amadastTrackingCode: dispatch.amadast_tracking_code, courierTrackingCode: dispatch.courier_tracking_code, courierTitle: dispatch.courier_title, errorCode: dispatch.last_error_code, registeredAt: dispatch.registered_at?.toISOString() ?? null, trackingSyncedAt: dispatch.tracking_synced_at?.toISOString() ?? null };
  }
}
