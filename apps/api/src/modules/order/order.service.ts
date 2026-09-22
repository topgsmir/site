import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma, order_status, product_type } from "../../prisma/client";
import type { AppUser } from "@topgsm/shared-types";
import { createHash, randomUUID } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { CredentialCryptoService } from "../bridge/credential-crypto.service";
import type {
  CreateOrderDto,
  ListOrdersQueryDto,
  UpdateOrderShippingDto,
  UpdateOrderStatusDto
} from "./dto/order.dto";
import { UsdRateService } from "../usd-rate/usd-rate.service";
import { AmadastSettingsService } from "../../integrations/shipping/amadast/amadast-settings.service";
import { SellerShippingProfileService } from "../../integrations/shipping/seller-shipping-profile.service";
import { signUploadDownloadLink } from "./upload-download-link";

const orderSelect = {
  id: true,
  traffic_source: true,
  buyer_id: true,
  seller_id: true,
  checkout_id: true,
  status: true,
  currency: true,
  total_amount: true,
  commission_rate: true,
  holdback_rate: true,
  created_at: true,
  updated_at: true,
  seller: { select: { shop_name: true, goghdi_agent_id: true } },
  buyer: { select: { full_name: true, email: true, phone_number: true } },
  shipping_address: { select: { recipient_name: true, phone_number: true, province: true, city: true, postal_code: true, address_line: true } },
  shipment: { select: { carrier: true, tracking_code: true, shipped_at: true } },
  amadast_shipment: { select: { id: true, status: true, provider_order_id: true, amadast_tracking_code: true, courier_tracking_code: true, courier_title: true, last_error_code: true, registered_at: true, tracking_synced_at: true } },
  items: {
    select: {
      id: true,
      offer_id: true,
      product_type: true,
      product_title: true,
      quantity: true,
      unit_price: true,
      total_amount: true,
      service_note: true,
      service_input_schema: true,
      encrypted_service_answers: true,
      service_answers_key_id: true,
      digital_entitlement: { select: { delivery_url: true, max_downloads: true, download_count: true } },
      bridge_fulfillment: {
        select: { id: true, mode: true, status: true, last_error_code: true, completed_at: true, encrypted_input: true, encryption_key_id: true, encrypted_result: true, result_encryption_key_id: true }
      }
    }
  }
} satisfies Prisma.ordersSelect;

const buyerOrderSummarySelect = {
  id: true,
  status: true,
  currency: true,
  total_amount: true,
  created_at: true,
  seller: { select: { shop_name: true, goghdi_agent_id: true } },
  items: { select: { id: true, product_title: true, product_type: true, quantity: true } }
} satisfies Prisma.ordersSelect;

const adminOrderDirectorySelect = {
  id: true, status: true, currency: true, total_amount: true, traffic_source: true, created_at: true,
  seller: { select: { shop_name: true } },
  buyer: { select: { full_name: true, email: true, phone_number: true } },
  shipping_address: { select: { recipient_name: true, province: true, city: true, address_line: true, postal_code: true } },
  shipment: { select: { carrier: true, tracking_code: true } },
  items: { select: { id: true, product_title: true, product_type: true, quantity: true } }
} satisfies Prisma.ordersSelect;

type OrderRecord = Prisma.ordersGetPayload<{ select: typeof orderSelect }>;

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly crypto?: CredentialCryptoService,
    @Optional() private readonly config?: ConfigService,
    @Optional() private readonly usdRates?: UsdRateService,
    @Optional() private readonly amadastSettings?: AmadastSettingsService,
    @Optional() private readonly sellerShippingProfiles?: SellerShippingProfileService
  ) {}

  async newOrderCount(actor: AppUser) {
    if (actor.role === "buyer") {
      throw new ForbiddenException("Seller or platform order access is required");
    }

    return {
      count: await this.prisma.orders.count({
        where: {
          ...await this.scope(actor),
          status: "paid"
        }
      })
    };
  }

  async list(actor: AppUser, input: ListOrdersQueryDto) {
    if (input.view === "directory" && !this.hasPlatformPermission(actor, "orders_manage")) {
      throw new ForbiddenException("Platform order access is required");
    }
    const from = input.dateFrom ? new Date(`${input.dateFrom}T00:00:00.000Z`) : undefined;
    const to = input.dateTo ? new Date(`${input.dateTo}T00:00:00.000Z`) : undefined;
    if ((from && (Number.isNaN(from.getTime()) || from.toISOString().slice(0, 10) !== input.dateFrom)) ||
        (to && (Number.isNaN(to.getTime()) || to.toISOString().slice(0, 10) !== input.dateTo)) ||
        (from && to && from > to)) throw new BadRequestException("Invalid order date range");
    const term = input.search?.trim();
    if (term && term.length < 3) throw new BadRequestException("Order search needs at least 3 characters");
    const where: Prisma.ordersWhereInput = {
      ...await this.scope(actor),
      ...(input.status ? { status: input.status as order_status } : {}),
      ...(input.productType ? { items: { some: { product_type: input.productType as product_type } } } : {}),
      ...(from || to ? { created_at: { ...(from ? { gte: from } : {}), ...(to ? { lt: new Date(to.getTime() + 86_400_000) } : {}) } } : {}),
      ...(term ? { OR: [
        { id: { contains: term, mode: "insensitive" } },
        { buyer: { full_name: { contains: term, mode: "insensitive" } } },
        { buyer: { email: { contains: term, mode: "insensitive" } } },
        { buyer: { phone_number: { contains: term } } },
        { seller: { shop_name: { contains: term, mode: "insensitive" } } },
        { items: { some: { product_title: { contains: term, mode: "insensitive" } } } },
        { traffic_source: { contains: term, mode: "insensitive" } }
      ] } : {})
    };
    const direction = input.sort === "oldest" ? "asc" : "desc";
    if (input.cursor) {
      const cursor = await this.prisma.orders.findFirst({
        where: { ...where, id: input.cursor },
        select: { id: true }
      });
      if (!cursor) throw new NotFoundException("Order page cursor was not found");
    }
    if (input.view === "directory") {
      const rows = await this.prisma.orders.findMany({
        where,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        take: input.limit + 1,
        orderBy: [{ created_at: direction }, { id: direction }],
        select: adminOrderDirectorySelect
      });
      const hasMore = rows.length > input.limit;
      const page = hasMore ? rows.slice(0, input.limit) : rows;
      return {
        items: page.map((order) => ({
          id: order.id, status: order.status, currency: order.currency.trim(),
          totalAmount: order.total_amount.toString(), trafficSource: order.traffic_source,
          createdAt: order.created_at.toISOString(),
          seller: { shopName: order.seller.shop_name },
          buyer: { fullName: order.buyer.full_name, email: order.buyer.email, phoneNumber: order.buyer.phone_number },
          shippingAddress: order.shipping_address ? {
            recipientName: order.shipping_address.recipient_name, province: order.shipping_address.province,
            city: order.shipping_address.city, addressLine: order.shipping_address.address_line,
            postalCode: order.shipping_address.postal_code.trim()
          } : null,
          shipment: order.shipment ? { carrier: order.shipment.carrier, trackingCode: order.shipment.tracking_code } : null,
          items: order.items.map((item) => ({ id: item.id, productTitle: item.product_title, productType: item.product_type, quantity: item.quantity }))
        })),
        nextCursor: hasMore ? page.at(-1)?.id ?? null : null
      };
    }
    if (actor.role === "buyer") {
      const rows = await this.prisma.orders.findMany({
        where,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        take: input.limit + 1,
        orderBy: [{ created_at: direction }, { id: direction }],
        select: buyerOrderSummarySelect
      });
      const hasMore = rows.length > input.limit;
      const page = hasMore ? rows.slice(0, input.limit) : rows;
      return {
        items: page.map((order) => ({
          id: order.id,
          status: order.status,
          currency: order.currency.trim(),
          totalAmount: order.total_amount.toString(),
          createdAt: order.created_at.toISOString(),
          seller: { shopName: order.seller.shop_name },
          chatAvailable: Boolean(order.seller.goghdi_agent_id),
          items: order.items.map((item) => ({
            id: item.id,
            productTitle: item.product_title,
            productType: item.product_type,
            quantity: item.quantity
          }))
        })),
        nextCursor: hasMore ? page.at(-1)?.id ?? null : null
      };
    }
    const rows = await this.prisma.orders.findMany({
      where,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      take: input.limit + 1,
      orderBy: [{ created_at: direction }, { id: direction }],
      select: orderSelect
    });
    const hasMore = rows.length > input.limit;
    const page = hasMore ? rows.slice(0, input.limit) : rows;
    await this.auditBridgeAccess(actor.id, page, "list");
    const revealServiceAnswers = actor.role === "seller-admin" || actor.role === "seller-staff";
    return {
      items: page.map((order) => this.map(order, revealServiceAnswers)),
      nextCursor: hasMore ? page.at(-1)?.id ?? null : null,
      shippingProviders: {
        amadast: {
          enabled: actor.role === "seller-admin" || actor.role === "seller-staff"
            ? Boolean(await this.amadastSettings?.isEnabled() && await this.sellerShippingProfiles?.isReadyForActor(actor))
            : false
        }
      }
    };
  }

  async get(actor: AppUser, orderId: string) {
    const where = await this.scope(actor);
    const order = await this.prisma.orders.findFirst({ where: { ...where, id: orderId }, select: orderSelect });
    if (!order) throw new NotFoundException("Order was not found");
    await this.auditBridgeAccess(actor.id, [order], "detail");
    return this.mapForActor(order, actor);
  }

  async create(actor: AppUser, input: CreateOrderDto, idempotencyKey: string) {
    if (actor.role !== "buyer") {
      throw new ForbiddenException("Only buyers can create orders");
    }
    const normalizedBridgeFields = (input.bridgeFields ?? [])
      .map((item) => ({ key: item.key.trim(), value: item.value.normalize("NFKC").trim() }))
      .sort((left, right) => left.key.localeCompare(right.key));
    const requestHash = this.hash({ offerId: input.offerId, quantity: input.quantity, bridgeFields: normalizedBridgeFields });

    try {
      const order = await this.serializable(async (transaction) => {
        const replay = await transaction.orders.findUnique({
          where: {
            buyer_id_idempotency_key: {
              buyer_id: actor.id,
              idempotency_key: idempotencyKey
            }
          },
          select: { ...orderSelect, request_hash: true }
        });
        if (replay) {
          this.assertSameRequest(replay.request_hash, requestHash);
          return replay;
        }

        const offer = await transaction.seller_offers.findFirst({
          where: {
            id: input.offerId,
            status: "active",
            listing: {
              status: "active",
              product: { status: "active" },
              seller: {
                invited: false,
                approved: true,
                suspended_at: null
              }
            }
          },
          select: {
            id: true,
            price: true,
            currency: true,
            digital: { select: { file_reference: true, max_downloads: true } },
            physical: { select: { stock: true } },
            listing: {
              select: {
                seller: {
                  select: {
                    id: true,
                    shop_name: true,
                    commission: true,
                    holdback_rate: true
                  }
                },
                product: {
                  select: {
                    title: true,
                    type: true,
                    bridge_binding: {
                      select: {
                        mode: true,
                        minimum_quantity: true,
                        maximum_quantity: true,
                        accepted_schema_hash: true,
                        schema_review_needed: true,
                        grant: {
                          select: {
                            id: true,
                            status: true,
                            service: { select: { field_schema: true, schema_hash: true, available: true, connection: { select: { status: true } } } }
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        });
        if (!offer) throw new NotFoundException("Offer was not found");

        if (offer.listing.product.type === "bridge" && this.config?.get<string>("BRIDGE_FEATURE_ENABLED") !== "true") throw new ServiceUnavailableException("Bridge is not enabled");
        const bridgePlan = offer.listing.product.type === "bridge"
          ? this.prepareBridgeFulfillment(offer.listing.product.bridge_binding, input.quantity, normalizedBridgeFields)
          : null;
        if (offer.listing.product.type !== "bridge" && normalizedBridgeFields.length) {
          throw new BadRequestException("Only Bridge orders accept provider fields");
        }

        const offerCurrency = offer.currency.trim();
        if ((offerCurrency !== "TOMAN" && offerCurrency !== "USD") || (offerCurrency === "TOMAN" && !offer.price.isInteger())) {
          throw new BadRequestException("The offer currency or precision is unsupported");
        }
        if (offerCurrency === "USD" && !this.usdRates) {
          throw new ServiceUnavailableException("The USD exchange rate service is unavailable");
        }
        if (offer.listing.product.type === "digital" && (!offer.digital || !this.isHttpsUrl(offer.digital.file_reference))) {
          throw new ConflictException("This digital offer has no valid HTTPS delivery URL");
        }

        if (offer.listing.product.type === "physical") {
          const inventory = await transaction.seller_offer_physical.updateMany({
            where: { offer_id: offer.id, stock: { gte: input.quantity } },
            data: { stock: { decrement: input.quantity } }
          });
          if (inventory.count !== 1) {
            throw new ConflictException("The requested quantity is not available");
          }
        }

        const unitPrice = offerCurrency === "USD"
          ? offer.price.mul(await this.usdRates!.getTomanPerUsd(transaction)).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP)
          : offer.price;
        const currency = "TOMAN";
        const gross = unitPrice.mul(input.quantity);
        const commission = gross
          .mul(offer.listing.seller.commission)
          .toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
        const holdback = gross
          .mul(offer.listing.seller.holdback_rate)
          .toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
        const payable = gross.minus(commission).minus(holdback);
        if (payable.isNegative()) {
          throw new ConflictException("Seller payout terms are invalid");
        }

        const created = await transaction.orders.create({
          data: {
            buyer_id: actor.id,
            traffic_source: input.trafficSource ?? null,
            seller_id: offer.listing.seller.id,
            status: "pending",
            currency,
            total_amount: gross,
            commission_rate: offer.listing.seller.commission,
            holdback_rate: offer.listing.seller.holdback_rate,
            idempotency_key: idempotencyKey,
            request_hash: requestHash,
            items: {
              create: {
                offer_id: offer.id,
                product_type: offer.listing.product.type,
                product_title: offer.listing.product.title,
                quantity: input.quantity,
                unit_price: unitPrice,
                total_amount: gross,
                ...(offer.listing.product.type === "digital" && offer.digital && this.isHttpsUrl(offer.digital.file_reference)
                  ? { digital_delivery_url: offer.digital.file_reference, digital_max_downloads: offer.digital.max_downloads }
                  : {}),
                ...(bridgePlan
                  ? {
                      bridge_fulfillment: {
                        create: {
                          id: bridgePlan.id,
                          grant_id: bridgePlan.grantId,
                          mode: bridgePlan.mode,
                          status: "waiting_payment",
                          encrypted_input: bridgePlan.encryptedInput,
                          encryption_key_id: bridgePlan.keyId,
                          schema_snapshot: bridgePlan.schema as Prisma.InputJsonValue
                        }
                      }
                    }
                  : {})
              }
            },
            payout_records: {
              create: {
                gross_amount: gross,
                commission_amount: commission,
                holdback_amount: holdback,
                payable_amount: payable,
                currency,
                status: "draft"
              }
            }
          },
          select: orderSelect
        });

        if (offer.listing.product.type === "physical") {
          const item = created.items[0];
          if (!item) throw new ConflictException("Order has no inventory item");
          await transaction.inventory_reservations.create({
            data: { order_item_id: item.id, offer_id: offer.id, quantity: input.quantity, expires_at: new Date(Date.now() + 15 * 60 * 1000) }
          });
        }

        await transaction.order_events.create({
          data: {
            order_id: created.id,
            actor_user_id: actor.id,
            from_status: null,
            to_status: "pending",
            idempotency_key: idempotencyKey,
            request_hash: requestHash
          }
        });
        await transaction.outbox_events.create({
          data: {
            aggregate: "order",
            aggregate_id: created.id,
            event_type: "order.created",
            dedupe_key: `order.created:${created.id}`,
            payload: {
              orderId: created.id,
              buyerId: actor.id,
              sellerId: created.seller_id,
              status: created.status
            }
          }
        });
        return created;
      });
      return this.mapForActor(order, actor);
    } catch (error) {
      if (this.isUniqueConflict(error)) {
        const replay = await this.prisma.orders.findUnique({
          where: {
            buyer_id_idempotency_key: {
              buyer_id: actor.id,
              idempotency_key: idempotencyKey
            }
          },
          select: { ...orderSelect, request_hash: true }
        });
        if (replay) {
          this.assertSameRequest(replay.request_hash, requestHash);
          return this.mapForActor(replay, actor);
        }
      }
      throw error;
    }
  }

  async transition(
    actor: AppUser,
    orderId: string,
    input: UpdateOrderStatusDto,
    idempotencyKey: string
  ) {
    const requestHash = this.hash({ orderId, status: input.status });
    const sellerId = await this.sellerIdFor(actor, "orders_manage");

    try {
      const order = await this.serializable(async (transaction) => {
        const replay = await transaction.order_events.findUnique({
          where: {
            actor_user_id_idempotency_key: {
              actor_user_id: actor.id,
              idempotency_key: idempotencyKey
            }
          },
          select: { request_hash: true, order: { select: orderSelect } }
        });
        if (replay) {
          this.assertSameRequest(replay.request_hash, requestHash);
          return replay.order;
        }

        const current = await transaction.orders.findFirst({
          where: {
            id: orderId,
            ...(this.hasPlatformPermission(actor, "orders_manage")
              ? {}
              : actor.role === "buyer"
                ? { buyer_id: actor.id }
                : { seller_id: sellerId ?? "" })
          },
          select: { ...orderSelect, items: { select: { id: true, product_type: true, inventory_reservation: { select: { id: true, offer_id: true, quantity: true, status: true } } } } }
        });
        if (!current) throw new NotFoundException("Order was not found");

        const productType = current.items[0]?.product_type;
        if (!productType) throw new ConflictException("Order has no fulfillment item");
        this.assertTransition(actor, current.status, input.status, productType);

        const changed = await transaction.orders.updateMany({
          where: { id: orderId, status: current.status },
          data: { status: input.status }
        });
        if (changed.count !== 1) {
          throw new ConflictException("The order changed; reload and try again");
        }
        if (input.status === "cancelled") {
          for (const item of current.items) {
            const reservation = item.inventory_reservation;
            if (!reservation || reservation.status !== "active") continue;
            const released = await transaction.inventory_reservations.updateMany({ where: { id: reservation.id, status: "active" }, data: { status: "released" } });
            if (released.count === 1) {
              await transaction.seller_offer_physical.update({ where: { offer_id: reservation.offer_id }, data: { stock: { increment: reservation.quantity } } });
            }
          }
        }
        await transaction.order_events.create({
          data: {
            order_id: orderId,
            actor_user_id: actor.id,
            from_status: current.status,
            to_status: input.status,
            idempotency_key: idempotencyKey,
            request_hash: requestHash
          }
        });
        await transaction.outbox_events.create({
          data: {
            aggregate: "order",
            aggregate_id: orderId,
            event_type: "order.status.updated",
            dedupe_key: `order.status.updated:${actor.id}:${idempotencyKey}`,
            payload: {
              orderId,
              buyerId: current.buyer_id,
              sellerId: current.seller_id,
              fromStatus: current.status,
              status: input.status
            }
          }
        });
        return transaction.orders.findUniqueOrThrow({
          where: { id: orderId },
          select: orderSelect
        });
      });
      return this.mapForActor(order, actor);
    } catch (error) {
      if (this.isUniqueConflict(error)) {
        const replay = await this.prisma.order_events.findUnique({
          where: {
            actor_user_id_idempotency_key: {
              actor_user_id: actor.id,
              idempotency_key: idempotencyKey
            }
          },
          select: { request_hash: true, order: { select: orderSelect } }
        });
        if (replay) {
          this.assertSameRequest(replay.request_hash, requestHash);
          return this.mapForActor(replay.order, actor);
        }
      }
      throw error;
    }
  }

  async ship(actor: AppUser, orderId: string, input: UpdateOrderShippingDto, idempotencyKey: string) {
    if (!input.carrier?.trim() && !input.trackingCode?.trim()) throw new BadRequestException("Carrier or tracking code is required");
    const sellerId = await this.sellerIdFor(actor, "orders_manage");
    if (!sellerId) throw new ForbiddenException("Seller access is required");
    const requestHash = this.hash({ orderId, carrier: input.carrier?.trim() ?? null, trackingCode: input.trackingCode?.trim() ?? null });
    return this.serializable(async (tx) => {
      const replay = await tx.order_events.findUnique({ where: { actor_user_id_idempotency_key: { actor_user_id: actor.id, idempotency_key: idempotencyKey } }, select: { request_hash: true, order: { select: orderSelect } } });
      if (replay) { this.assertSameRequest(replay.request_hash, requestHash); return this.map(replay.order); }
      const order = await tx.orders.findFirst({ where: { id: orderId, seller_id: sellerId, status: "processing", items: { some: { product_type: "physical" } } }, select: { id: true, buyer_id: true, seller_id: true } });
      if (!order) throw new NotFoundException("A processing physical order was not found");
      const changed = await tx.orders.updateMany({ where: { id: order.id, seller_id: sellerId, status: "processing" }, data: { status: "shipped" } });
      if (changed.count !== 1) throw new ConflictException("Order changed before shipment was recorded");
      await tx.order_shipments.upsert({
        where: { order_id: order.id },
        create: { order_id: order.id, carrier: input.carrier?.trim() || null, tracking_code: input.trackingCode?.trim() || null },
        update: { carrier: input.carrier?.trim() || null, tracking_code: input.trackingCode?.trim() || null, shipped_at: new Date() }
      });
      await tx.order_events.create({ data: { order_id: order.id, actor_user_id: actor.id, from_status: "processing", to_status: "shipped", idempotency_key: idempotencyKey, request_hash: requestHash } });
      await tx.outbox_events.create({ data: { aggregate: "order", aggregate_id: order.id, event_type: "order.status.updated", dedupe_key: `order.shipped:${actor.id}:${idempotencyKey}`, payload: { orderId: order.id, buyerId: order.buyer_id, sellerId: order.seller_id, fromStatus: "processing", status: "shipped" } } });
      return this.map(await tx.orders.findUniqueOrThrow({ where: { id: order.id }, select: orderSelect }));
    });
  }

  async claimDigitalDownload(actor: AppUser, orderId: string, itemId: string, clientIp: string) {
    if (actor.role !== "buyer") throw new ForbiddenException("Only buyers can download purchases");
    return this.prisma.$transaction(async (tx) => {
      const entitlement = await tx.digital_entitlements.findFirst({
        where: { order_item_id: itemId, buyer_id: actor.id, order_item: { order_id: orderId, order: { buyer_id: actor.id, status: { in: ["paid", "processing", "awaiting_confirmation", "delivered"] } } } },
        select: { id: true, delivery_url: true, max_downloads: true, download_count: true }
      });
      if (!entitlement) throw new NotFoundException("Digital delivery was not found");
      if (entitlement.max_downloads > 0 && entitlement.download_count >= entitlement.max_downloads) throw new ConflictException("The download limit has been reached");
      let signedUrl: string;
      try {
        signedUrl = signUploadDownloadLink(
          entitlement.delivery_url,
          clientIp,
          this.config?.get<string>("UPLOAD_DOWNLOAD_HOSTS") ?? "",
          this.config?.get<string>("UPLOAD_DOWNLOAD_SECRET") ?? ""
        );
      } catch {
        throw new ServiceUnavailableException("Digital delivery is not configured");
      }
      const claimed = await tx.digital_entitlements.updateMany({
        where: { id: entitlement.id, ...(entitlement.max_downloads > 0 ? { download_count: { lt: entitlement.max_downloads } } : {}) },
        data: { download_count: { increment: 1 }, last_accessed_at: new Date() }
      });
      if (claimed.count !== 1) throw new ConflictException("The download limit has been reached");
      return signedUrl;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  }

  private async scope(actor: AppUser): Promise<Prisma.ordersWhereInput> {
    if (this.hasPlatformPermission(actor, "orders_manage")) return {};
    if (actor.role === "buyer") return { buyer_id: actor.id };
    const sellerId = await this.sellerIdFor(actor, "orders_manage");
    return { seller_id: sellerId ?? "" };
  }

  private async sellerIdFor(
    actor: AppUser,
    permission: "orders_manage" | "payouts_request"
  ) {
    if (this.hasPlatformPermission(actor, "orders_manage") || actor.role === "buyer") return null;
    if (actor.role !== "seller-admin" && actor.role !== "seller-staff") {
      throw new ForbiddenException("Seller access is required");
    }
    const membership = await this.prisma.seller_memberships.findFirst({
      where: {
        user_id: actor.id,
        active: true,
        seller: {
          invited: false,
          approved: true,
          suspended_at: null,
          permissions: { some: { permission } }
        }
      },
      select: { seller: { select: { id: true } } }
    });
    if (!membership) throw new ForbiddenException(`Active seller ${permission} permission is required`);
    return membership.seller.id;
  }

  private assertTransition(
    actor: AppUser,
    from: order_status,
    to: UpdateOrderStatusDto["status"],
    productType: product_type
  ) {
    let allowed: boolean;
    if (this.hasPlatformPermission(actor, "orders_manage")) {
      allowed = to === "cancelled" && from !== "cancelled" && from !== "delivered";
    } else if (actor.role === "buyer") {
      allowed =
        (from === "pending" && to === "cancelled") ||
        (productType === "digital" && from === "paid" && to === "delivered") ||
        (productType === "physical" && from === "shipped" && to === "delivered") ||
        (productType !== "physical" &&
          from === "awaiting_confirmation" &&
          to === "delivered");
    } else {
      allowed =
        (from === "paid" && to === "processing") ||
        (productType === "physical" && from === "processing" && to === "shipped") ||
        (productType !== "physical" &&
          from === "processing" &&
          to === "awaiting_confirmation");
    }
    if (!allowed) {
      throw new ConflictException(`Transition from ${from} to ${to} is not allowed`);
    }
  }

  private async serializable<T>(
    work: (transaction: Prisma.TransactionClient) => Promise<T>
  ) {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await this.prisma.$transaction(work, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable
        });
      } catch (error) {
        if (
          attempt >= 2 ||
          !(error instanceof Prisma.PrismaClientKnownRequestError) ||
          error.code !== "P2034"
        ) {
          throw error;
        }
      }
    }
  }

  private hasPlatformPermission(actor: AppUser, permission: "orders_manage") {
    return (
      actor.role === "platform-admin" ||
      (actor.role === "platform-staff" &&
        actor.platformPermissions?.includes(permission) === true)
    );
  }

  private assertSameRequest(stored: string, incoming: string) {
    if (stored.trim() !== incoming) {
      throw new ConflictException("Idempotency-Key was already used for another request");
    }
  }

  private isUniqueConflict(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
  }

  private hash(value: unknown) {
    return createHash("sha256").update(JSON.stringify(value)).digest("hex");
  }

  private map(order: OrderRecord, revealSensitiveServiceAnswers = false) {
    return {
      id: order.id,
      buyerId: order.buyer_id,
      checkoutId: order.checkout_id,
      trafficSource: order.traffic_source,
      seller: { id: order.seller_id, shopName: order.seller.shop_name },
      buyer: { fullName: order.buyer.full_name, email: order.buyer.email, phoneNumber: order.buyer.phone_number },
      status: order.status,
      currency: order.currency.trim(),
      totalAmount: order.total_amount.toString(),
      commissionRate: order.commission_rate.toString(),
      holdbackRate: order.holdback_rate.toString(),
      shippingAddress: order.shipping_address ? { recipientName: order.shipping_address.recipient_name, phoneNumber: order.shipping_address.phone_number, province: order.shipping_address.province, city: order.shipping_address.city, postalCode: order.shipping_address.postal_code.trim(), addressLine: order.shipping_address.address_line } : null,
      shipment: order.shipment ? { carrier: order.shipment.carrier, trackingCode: order.shipment.tracking_code, shippedAt: order.shipment.shipped_at.toISOString() } : null,
      amadastShipment: order.amadast_shipment ? { externalOrderId: order.amadast_shipment.id, status: order.amadast_shipment.status, providerOrderId: order.amadast_shipment.provider_order_id, amadastTrackingCode: order.amadast_shipment.amadast_tracking_code, courierTrackingCode: order.amadast_shipment.courier_tracking_code, courierTitle: order.amadast_shipment.courier_title, errorCode: order.amadast_shipment.last_error_code, registeredAt: order.amadast_shipment.registered_at?.toISOString() ?? null, trackingSyncedAt: order.amadast_shipment.tracking_synced_at?.toISOString() ?? null } : null,
      items: order.items.map((item) => ({
        id: item.id,
        offerId: item.offer_id,
        productType: item.product_type,
        productTitle: item.product_title,
        quantity: item.quantity,
        unitPrice: item.unit_price.toString(),
        totalAmount: item.total_amount.toString(),
        serviceNote: item.service_note,
        serviceInputs: this.mapServiceInputs(item, revealSensitiveServiceAnswers),
        ...(item.digital_entitlement ? { digitalDelivery: { downloadUrl: `/orders/${order.id}/items/${item.id}/download`, destinationHost: new URL(item.digital_entitlement.delivery_url).hostname, maxDownloads: item.digital_entitlement.max_downloads, downloadCount: item.digital_entitlement.download_count } } : {}),
        ...(item.bridge_fulfillment
          ? {
              bridge: {
                id: item.bridge_fulfillment.id,
                mode: item.bridge_fulfillment.mode,
                status: item.bridge_fulfillment.status,
                errorCode: item.bridge_fulfillment.last_error_code,
                completedAt: item.bridge_fulfillment.completed_at?.toISOString() ?? null,
                input: this.decryptBridgeValue(item.bridge_fulfillment.encrypted_input, item.bridge_fulfillment.encryption_key_id, `bridge-fulfillment:${item.bridge_fulfillment.id}:input`),
                result: item.bridge_fulfillment.encrypted_result && item.bridge_fulfillment.result_encryption_key_id
                  ? this.decryptBridgeValue(item.bridge_fulfillment.encrypted_result, item.bridge_fulfillment.result_encryption_key_id, `bridge-fulfillment:${item.bridge_fulfillment.id}:result`)
                  : null
              }
            }
          : {})
      })),
      createdAt: order.created_at.toISOString(),
      updatedAt: order.updated_at.toISOString()
    };
  }

  private mapForActor(order: OrderRecord, actor: AppUser) {
    const mapped = this.map(
      order,
      actor.role === "seller-admin" || actor.role === "seller-staff"
    );
    if (actor.role !== "buyer") return mapped;
    return {
      id: mapped.id,
      checkoutId: mapped.checkoutId,
      seller: mapped.seller,
      chatAvailable: Boolean(order.seller.goghdi_agent_id),
      status: mapped.status,
      currency: mapped.currency,
      totalAmount: mapped.totalAmount,
      shippingAddress: mapped.shippingAddress,
      shipment: mapped.shipment,
      items: mapped.items,
      createdAt: mapped.createdAt,
      updatedAt: mapped.updatedAt
    };
  }

  private isHttpsUrl(value: string) {
    try { return new URL(value).protocol === "https:"; } catch { return false; }
  }

  private decryptBridgeValue(ciphertext: string, keyId: string, purpose: string) {
    if (!this.crypto) return null;
    try { return JSON.parse(this.crypto.decrypt(ciphertext, keyId, purpose)) as unknown; }
    catch { return null; }
  }

  private mapServiceInputs(
    item: Pick<OrderRecord["items"][number], "id" | "service_input_schema" | "encrypted_service_answers" | "service_answers_key_id">,
    revealSensitive: boolean
  ) {
    const answers = new Map<string, string>();
    if (this.crypto && item.encrypted_service_answers && item.service_answers_key_id) {
      try {
        const decrypted = JSON.parse(this.crypto.decrypt(
          item.encrypted_service_answers,
          item.service_answers_key_id,
          `service-order-item:${item.id}:answers`,
          "SERVICE_INPUT"
        )) as unknown;
        if (Array.isArray(decrypted)) {
          for (const answer of decrypted) {
            if (
              answer && typeof answer === "object" && !Array.isArray(answer) &&
              typeof answer.key === "string" && typeof answer.value === "string"
            ) answers.set(answer.key, answer.value);
          }
        }
      } catch {
        // A missing or retired key must not leak ciphertext or break the entire order response.
      }
    }
    if (!Array.isArray(item.service_input_schema)) return [];
    return item.service_input_schema.flatMap((field) => {
      if (!field || typeof field !== "object" || Array.isArray(field)) return [];
      if (
        typeof field.key !== "string" || typeof field.label !== "string" ||
        !["text", "textarea", "password"].includes(String(field.type))
      ) return [];
      const sensitive = field.type === "password";
      return [{
        key: field.key,
        label: field.label,
        type: field.type as "text" | "textarea" | "password",
        value: sensitive && !revealSensitive ? null : answers.get(field.key) ?? null,
        sensitive
      }];
    });
  }

  private async auditBridgeAccess(userId: string, orders: OrderRecord[], accessKind: "list" | "detail") {
    const fulfillmentIds = orders.flatMap((order) => order.items.map((item) => item.bridge_fulfillment?.id).filter((id): id is string => Boolean(id)));
    if (fulfillmentIds.length) await this.prisma.bridge_data_access_audits.createMany({ data: fulfillmentIds.map((fulfillmentId) => ({ fulfillment_id: fulfillmentId, user_id: userId, access_kind: accessKind })) });
  }

  private prepareBridgeFulfillment(
    binding: {
      mode: "automatic" | "manual";
      minimum_quantity: number;
      maximum_quantity: number;
      accepted_schema_hash: string;
      schema_review_needed: boolean;
      grant: {
        id: string;
        status: "active" | "revoked";
        service: {
          field_schema: Prisma.JsonValue;
          schema_hash: string;
          available: boolean;
          connection: { status: "active" | "inactive" | "error" };
        };
      };
    } | null,
    quantity: number,
    values: Array<{ key: string; value: string }>
  ) {
    if (!binding || binding.schema_review_needed || (binding.mode === "automatic" && (
      binding.grant.status !== "active" || !binding.grant.service.available ||
      binding.grant.service.connection.status !== "active" ||
      binding.accepted_schema_hash !== binding.grant.service.schema_hash
    ))) {
      throw new ConflictException("Bridge service is currently unavailable");
    }
    if (quantity < binding.minimum_quantity || quantity > binding.maximum_quantity) {
      throw new BadRequestException(`Quantity must be between ${binding.minimum_quantity} and ${binding.maximum_quantity}`);
    }
    const schema = this.jsonArray(binding.grant.service.field_schema);
    const supplied = new Map(values.map((item) => [item.key, item.value]));
    const allowed = new Set(schema.map((item) => String(item.key ?? "")));
    for (const key of supplied.keys()) {
      if (!allowed.has(key)) throw new BadRequestException(`Unknown Bridge field: ${key}`);
    }
    const validated: Record<string, string> = {};
    for (const definition of schema) {
      const key = String(definition.key ?? "");
      const value = supplied.get(key) ?? "";
      if (definition.required === true && !value) throw new BadRequestException(`${key} is required`);
      const minimumLength = Number(definition.minimumLength ?? 0);
      const maximumLength = Number(definition.maximumLength ?? 5000);
      if (value.length < minimumLength || value.length > maximumLength) throw new BadRequestException(`${key} has an invalid length`);
      if (definition.type === "number" && value && !/^-?\d+(?:\.\d+)?$/.test(value)) throw new BadRequestException(`${key} must be numeric`);
      if (definition.type === "select" && value) {
        const options = Array.isArray(definition.options) ? definition.options : [];
        const choices = new Set(options.map((option) => option && typeof option === "object" && !Array.isArray(option) ? String(option.value ?? "") : ""));
        if (!choices.has(value)) throw new BadRequestException(`${key} is not an allowed choice`);
      }
      if (value) validated[key] = value;
    }
    const id = randomUUID();
    if (!this.crypto) throw new ConflictException("Bridge encryption is unavailable");
    const encrypted = this.crypto.encrypt(JSON.stringify({ fields: validated, quantity }), `bridge-fulfillment:${id}:input`);
    return { id, grantId: binding.grant.id, mode: binding.mode, schema, encryptedInput: encrypted.ciphertext, keyId: encrypted.keyId };
  }

  private jsonArray(value: Prisma.JsonValue): Array<Record<string, Prisma.JsonValue>> {
    return Array.isArray(value)
      ? value.filter((item): item is Record<string, Prisma.JsonValue> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
      : [];
  }
}
