import { mapDigitalDeliveries, digitalFileReferences, digitalFileTitles } from "../order/digital-delivery";
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
import { DateTime } from "luxon";
import { Prisma, order_status, product_type } from "../../prisma/client";
import type { AppUser } from "@topgsm/shared-types";
import { createHash, randomUUID } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { CredentialCryptoService } from "../bridge/credential-crypto.service";
import type {
  CreateOrderDto,
  ExportOrdersDto,
  ListOrdersQueryDto,
  UpdatePurchaseStatusDto,
  UpdateOrderShippingDto,
  UpdateOrderStatusDto
} from "./dto/order.dto";
import { UsdRateService } from "../usd-rate/usd-rate.service";
import { ShippingProviderRegistry } from "../../integrations/shipping/shipping-provider.registry";
import { SellerShippingProfileService } from "../../integrations/shipping/seller-shipping-profile.service";
import { signUploadDownloadLink } from "./upload-download-link";
import { buildOrderCsv } from "./order-export";

const orderSelect = {
  id: true,
  traffic_source: true,
  buyer_id: true,
  seller_id: true,
  checkout_id: true,
  status: true,
  trashed_at: true,
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
  shipping_dispatch: { select: { id: true, provider: true, status: true, provider_order_reference: true, legacy_provider_order_id: true, provider_tracking_code: true, courier_tracking_code: true, courier_title: true, last_error_code: true, registered_at: true, tracking_synced_at: true } },
  items: {
    select: {
      id: true,
      offer_id: true,
      offer: { select: { listing: { select: { product_id: true } } } },
      product_type: true,
      product_title: true,
      quantity: true,
      unit_price: true,
      total_amount: true,
      service_note: true,
      service_input_schema: true,
      encrypted_service_answers: true,
      service_answers_key_id: true,
      digital_delivery_titles: true,
      digital_entitlement: { orderBy: { file_index: "asc" }, select: { file_index: true, delivery_url: true, max_downloads: true, download_count: true } },
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

type PurchaseOrderSummary = {
  id: string;
  status: order_status;
  currency: string;
  totalAmount: string;
  createdAt: string;
  seller: { shopName: string };
  chatAvailable: boolean;
  items: Array<{ id: string; productTitle: string; productType: product_type; quantity: number }>;
  payment?: never;
};

const adminOrderDirectorySelect = {
  id: true, status: true, trashed_at: true, currency: true, total_amount: true, traffic_source: true, created_at: true,
  seller: { select: { shop_name: true } },
  buyer: { select: { full_name: true, email: true, phone_number: true } },
  shipping_address: { select: { recipient_name: true, province: true, city: true, address_line: true, postal_code: true } },
  shipment: { select: { carrier: true, tracking_code: true } },
  payment_attempts: { where: { status: { in: ["succeeded", "refund_pending", "refund_unknown", "refunded"] } }, orderBy: { created_at: "desc" }, take: 1, select: { provider: true, provider_ref_id: true } },
  items: { select: { id: true, product_title: true, product_type: true, quantity: true } }
} satisfies Prisma.ordersSelect;

const adminOrderExportSelect = {
  id: true, created_at: true, status: true, total_amount: true, currency: true, traffic_source: true,
  buyer: { select: { full_name: true, email: true, phone_number: true } },
  seller: { select: { shop_name: true } },
  items: { select: { product_title: true, quantity: true } },
  payment_attempts: { where: { status: { in: ["succeeded", "refund_pending", "refund_unknown", "refunded"] } }, orderBy: { created_at: "desc" }, take: 1, select: { provider: true, provider_ref_id: true } }
} satisfies Prisma.ordersSelect;

const directoryStatuses = ["pending", "paid", "processing", "shipped", "awaiting_confirmation", "delivered", "cancelled"] as const;
const refundedOrder = { payment_attempts: { some: { status: "refunded" as const } } };
const notRefundedOrder = { payment_attempts: { none: { status: "refunded" as const } } };
const directoryGroupStatuses = {
  pending: ["pending"],
  processing: ["paid", "processing", "shipped", "awaiting_confirmation"],
  completed: ["delivered"],
  cancelled: ["cancelled"]
} as const;

type OrderRecord = Prisma.ordersGetPayload<{ select: typeof orderSelect }>;

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly crypto?: CredentialCryptoService,
    @Optional() private readonly config?: ConfigService,
    @Optional() private readonly usdRates?: UsdRateService,
    @Optional() private readonly shippingProviders?: ShippingProviderRegistry,
    @Optional() private readonly sellerShippingProfiles?: SellerShippingProfileService
  ) {}

  async newOrderCount(actor: AppUser) {
    if (actor.role === "buyer") {
      throw new ForbiddenException("Seller or platform order access is required");
    }

    const [scope, viewer] = await Promise.all([
      this.scope(actor),
      this.prisma.users.findUnique({
        where: { id: actor.id },
        select: { orders_seen_at: true }
      })
    ]);

    return {
      count: await this.prisma.orders.count({
        where: {
          ...scope,
          trashed_at: null,
          status: "paid",
          ...(viewer?.orders_seen_at
            ? { created_at: { gt: viewer.orders_seen_at } }
            : {})
        }
      })
    };
  }

  async markOrdersSeen(actor: AppUser) {
    if (actor.role === "buyer") {
      throw new ForbiddenException("Seller or platform order access is required");
    }

    const scope = await this.scope(actor);
    const latestVisibleOrder = await this.prisma.orders.findFirst({
      where: { ...scope, trashed_at: null },
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
      select: { created_at: true }
    });
    const seenAt = latestVisibleOrder?.created_at ?? new Date(0);
    await this.prisma.users.updateMany({
      where: {
        id: actor.id,
        OR: [{ orders_seen_at: null }, { orders_seen_at: { lt: seenAt } }]
      },
      data: { orders_seen_at: seenAt }
    });

    return { count: 0 };
  }

  async list(actor: AppUser, input: ListOrdersQueryDto) {
    if (input.view === "directory" && !this.hasPlatformPermission(actor, "orders_manage")) {
      throw new ForbiddenException("Platform order access is required");
    }
    if (input.trash && input.view !== "directory") throw new ForbiddenException("Trash view requires platform order access");
    if (input.status && input.statusGroup) throw new BadRequestException("Choose one order status filter");
    if (input.statusGroup && input.view !== "directory") throw new BadRequestException("Status groups require the order directory");
    const { baseWhere, where } = await this.listWhere(actor, input);
    const direction = input.sort === "oldest" ? "asc" : "desc";
    if (input.cursor) {
      const cursor = await this.prisma.orders.findFirst({
        where: { ...where, id: input.cursor },
        select: { id: true }
      });
      if (!cursor) throw new NotFoundException("Order page cursor was not found");
    }
    if (input.view === "directory") {
      const [rows, statusRows, refundedCount] = await Promise.all([this.prisma.orders.findMany({
        where,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        take: input.limit + 1,
        orderBy: [{ created_at: direction }, { id: direction }],
        select: adminOrderDirectorySelect
      }), this.prisma.orders.groupBy({ by: ["status"], where: { ...baseWhere, ...notRefundedOrder }, _count: { _all: true } }),
      this.prisma.orders.count({ where: { ...baseWhere, ...refundedOrder } })]);
      const byStatus = new Map(statusRows.map((row) => [row.status, row._count._all]));
      const count = (...statuses: readonly order_status[]) => statuses.reduce((total, status) => total + (byStatus.get(status) ?? 0), 0);
      const statusCounts = {
        all: refundedCount + statusRows.reduce((total, row) => total + row._count._all, 0),
        pending: count(...directoryGroupStatuses.pending),
        processing: count(...directoryGroupStatuses.processing),
        completed: count(...directoryGroupStatuses.completed),
        cancelled: count(...directoryGroupStatuses.cancelled),
        returned: refundedCount,
        other: statusRows.reduce((total, row) => total + (directoryStatuses.includes(row.status) ? 0 : row._count._all), 0)
      };
      const hasMore = rows.length > input.limit;
      const page = hasMore ? rows.slice(0, input.limit) : rows;
      return {
        items: page.map((order) => ({
          id: order.id, status: order.status, trashedAt: order.trashed_at?.toISOString() ?? null, currency: order.currency.trim(),
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
          payment: order.payment_attempts[0] ? { provider: order.payment_attempts[0].provider, reference: order.payment_attempts[0].provider_ref_id } : null,
          items: order.items.map((item) => ({ id: item.id, productTitle: item.product_title, productType: item.product_type, quantity: item.quantity }))
        })),
        nextCursor: hasMore ? page.at(-1)?.id ?? null : null,
        statusCounts
      };
    }
    if (actor.role === "buyer") return this.purchasePage(where, input, direction);
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
    const activeShippingProvider = this.shippingProviders?.active();
    const shippingEnabled = actor.role === "seller-admin" || actor.role === "seller-staff"
      ? Boolean(activeShippingProvider && await activeShippingProvider.isConfigured() && await this.sellerShippingProfiles?.isReadyForActor(actor))
      : false;
    return {
      items: page.map((order) => this.map(order, revealServiceAnswers)),
      nextCursor: hasMore ? page.at(-1)?.id ?? null : null,
      shippingProvider: activeShippingProvider ? {
        code: activeShippingProvider.code,
        name: activeShippingProvider.displayName,
        enabled: shippingEnabled
      } : null,
      shippingProviders: {
        amadast: {
          enabled: activeShippingProvider?.code === "amadast" && shippingEnabled
        }
      }
    };
  }

  async listPurchases(actor: AppUser, input: ListOrdersQueryDto) {
    if (input.view || input.trash || input.statusGroup) throw new BadRequestException("Management filters are unavailable for purchases");
    const { where } = await this.listWhere(actor, input, true);
    const direction = input.sort === "oldest" ? "asc" : "desc";
    if (input.cursor) {
      const cursor = await this.prisma.orders.findFirst({ where: { ...where, id: input.cursor }, select: { id: true } });
      if (!cursor) throw new NotFoundException("Order page cursor was not found");
    }
    return this.purchasePage(where, input, direction);
  }

  private async purchasePage(where: Prisma.ordersWhereInput, input: ListOrdersQueryDto, direction: "asc" | "desc"): Promise<{ items: PurchaseOrderSummary[]; nextCursor: string | null; statusCounts?: never }> {
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
      items: page.map((order): PurchaseOrderSummary => ({
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

  async exportCsv(actor: AppUser, input: ExportOrdersDto) {
    if (!this.hasPlatformPermission(actor, "orders_manage")) {
      throw new ForbiddenException("Platform order access is required");
    }
    const { where } = await this.listWhere(actor, { ...input, view: "directory" });
    const direction = input.sort === "oldest" ? "asc" : "desc";
    const rows = await this.prisma.orders.findMany({
      where: { ...where, ...(input.selectedIds ? { id: { in: input.selectedIds } } : {}) },
      take: 5001,
      orderBy: [{ created_at: direction }, { id: direction }],
      select: adminOrderExportSelect
    });
    if (rows.length > 5000) throw new BadRequestException("Export exceeds 5000 orders; narrow the filters or date range");
    return buildOrderCsv(rows, input.columns, input.locale);
  }

  private async listWhere(actor: AppUser, input: Pick<ListOrdersQueryDto, "view" | "trash" | "status" | "statusGroup" | "productType" | "dateFrom" | "dateTo" | "search">, personal = false) {
    const fromDay = input.dateFrom ? DateTime.fromISO(input.dateFrom, { zone: "Asia/Tehran" }) : undefined;
    const toDay = input.dateTo ? DateTime.fromISO(input.dateTo, { zone: "Asia/Tehran" }) : undefined;
    if ((fromDay && (!fromDay.isValid || fromDay.toISODate() !== input.dateFrom)) ||
        (toDay && (!toDay.isValid || toDay.toISODate() !== input.dateTo)) ||
        (input.dateFrom && input.dateTo && input.dateFrom > input.dateTo)) throw new BadRequestException("Invalid order date range");
    const from = fromDay?.toUTC().toJSDate();
    const toExclusive = toDay?.plus({ days: 1 }).toUTC().toJSDate();
    const term = input.search?.trim();
    if (term && term.length < 3) throw new BadRequestException("Order search needs at least 3 characters");
    const baseWhere: Prisma.ordersWhereInput = {
      ...(personal ? { buyer_id: actor.id } : await this.scope(actor)),
      ...(input.view === "directory" ? { trashed_at: input.trash === "trashed" ? { not: null } : null } : {}),
      ...(input.productType ? { items: { some: { product_type: input.productType as product_type } } } : {}),
      ...(from || toExclusive ? { created_at: { ...(from ? { gte: from } : {}), ...(toExclusive ? { lt: toExclusive } : {}) } } : {}),
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
    const groupWhere: Prisma.ordersWhereInput = input.statusGroup === "returned"
      ? refundedOrder
      : input.statusGroup === "other"
        ? { ...notRefundedOrder, status: { notIn: [...directoryStatuses] } }
        : input.statusGroup
          ? { ...notRefundedOrder, status: { in: [...directoryGroupStatuses[input.statusGroup]] } }
          : {};
    const where: Prisma.ordersWhereInput = {
      ...baseWhere,
      ...(input.status ? { status: input.status as order_status } : {}),
      ...groupWhere
    };
    return { baseWhere, where };
  }

  async get(actor: AppUser, orderId: string, includeTrashed = false) {
    const where = await this.scope(actor);
    if (includeTrashed && !this.hasPlatformPermission(actor, "orders_manage")) throw new ForbiddenException("Platform order access is required");
    const order = await this.prisma.orders.findFirst({ where: { ...where, ...(includeTrashed ? { trashed_at: undefined } : {}), id: orderId }, select: orderSelect });
    if (!order) throw new NotFoundException("Order was not found");
    await this.auditBridgeAccess(actor.id, [order], "detail");
    return this.mapForActor(order, actor);
  }

  async getPurchase(actor: AppUser, orderId: string) {
    const order = await this.prisma.orders.findFirst({ where: { id: orderId, buyer_id: actor.id }, select: orderSelect });
    if (!order) throw new NotFoundException("Order was not found");
    return this.mapForBuyer(order);
  }

  async create(actor: AppUser, input: CreateOrderDto, idempotencyKey: string) {
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
            digital: { select: { file_reference: true, file_references: true, file_titles: true, max_downloads: true } },
            physical: { select: { stock: true } },
            listing: {
              select: {
                seller: {
                  select: {
                    id: true,
                    shop_name: true,
                    commission: true,
                  }
                },
                product: {
                  select: {
                    title: true,
                    type: true,
                    price_currency: true,
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
        if (!["bridge"].includes(offer.listing.product.type)) throw new BadRequestException("Use checkout for physical, digital, and service orders");

        if (offer.listing.product.type === "bridge" && this.config?.get<string>("BRIDGE_FEATURE_ENABLED") !== "true") throw new ServiceUnavailableException("Bridge is not enabled");
        const bridgePlan = offer.listing.product.type === "bridge"
          ? this.prepareBridgeFulfillment(offer.listing.product.bridge_binding, input.quantity, normalizedBridgeFields)
          : null;
        if (offer.listing.product.type !== "bridge" && normalizedBridgeFields.length) {
          throw new BadRequestException("Only Bridge orders accept provider fields");
        }

        const offerCurrency = offer.currency.trim();
        if (offerCurrency !== offer.listing.product.price_currency) {
          throw new ConflictException("This offer does not use the product currency");
        }
        if ((offerCurrency !== "TOMAN" && offerCurrency !== "USD") || (offerCurrency === "TOMAN" && !offer.price.isInteger())) {
          throw new BadRequestException("The offer currency or precision is unsupported");
        }
        if (offerCurrency === "USD" && !this.usdRates) {
          throw new ServiceUnavailableException("The USD exchange rate service is unavailable");
        }
        if (offer.listing.product.type === "digital" && (!offer.digital || !digitalFileReferences(offer.digital).every((url) => this.isHttpsUrl(url)))) {
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
        const payable = gross.minus(commission);
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
                  ? { digital_delivery_url: offer.digital.file_reference, digital_delivery_urls: digitalFileReferences(offer.digital), digital_delivery_titles: digitalFileTitles(offer.digital), digital_max_downloads: offer.digital.max_downloads }
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
      return this.mapForBuyer(order);
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
          return this.mapForBuyer(replay);
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
    return this.transitionWithScope(actor, orderId, input, idempotencyKey, false);
  }

  async transitionPurchase(actor: AppUser, orderId: string, input: UpdatePurchaseStatusDto, idempotencyKey: string) {
    return this.transitionWithScope(actor, orderId, input, idempotencyKey, true);
  }

  private async transitionWithScope(actor: AppUser, orderId: string, input: UpdateOrderStatusDto | UpdatePurchaseStatusDto, idempotencyKey: string, personalRoute: boolean) {
    const purchase = personalRoute || actor.role === "buyer";
    const requestHash = this.hash({ orderId, status: input.status, ...(personalRoute ? { intent: "purchase" } : {}) });
    const scope = purchase ? { buyer_id: actor.id } : await this.scope(actor);
    const mapResult = (order: OrderRecord) => purchase ? this.mapForBuyer(order) : this.mapForActor(order, actor);

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
          const authorized = await transaction.orders.findFirst({ where: { ...scope, id: replay.order.id, trashed_at: null }, select: { id: true } });
          if (!authorized) throw new NotFoundException("Order was not found");
          return replay.order;
        }

        const current = await transaction.orders.findFirst({
          where: {
            id: orderId,
            trashed_at: null,
            ...scope
          },
          select: { ...orderSelect, payout_records: { select: { status: true } }, items: { select: { id: true, product_type: true, inventory_reservation: { select: { id: true, offer_id: true, quantity: true, status: true } } } } }
        });
        if (!current) throw new NotFoundException("Order was not found");

        const productType = current.items[0]?.product_type;
        if (!productType) throw new ConflictException("Order has no fulfillment item");
        this.assertTransition(actor, current.status, input.status, productType, current.payout_records[0]?.status, purchase);
        if (!purchase && this.hasPlatformPermission(actor, "orders_manage") && !("confirmSensitive" in input && input.confirmSensitive)) {
          throw new BadRequestException("Confirm this administrative status change");
        }
        if (current.status === "pending" && (input.status === "delivered" || input.status === "cancelled")) {
          const inFlightPayment = await transaction.payment_attempts.count({ where: {
            status: { notIn: ["created", "failed", "refunded"] },
            OR: [
              { order_id: orderId },
              ...(current.checkout_id ? [{ checkout_payment_group: { checkout_id: current.checkout_id } }] : [])
            ]
          } });
          if (inFlightPayment) throw new ConflictException("Payment is in progress; complete or resolve it before changing this order");
        }

        const changed = await transaction.orders.updateMany({
          where: { id: orderId, status: current.status, trashed_at: null },
          data: { status: input.status }
        });
        if (changed.count !== 1) {
          throw new ConflictException("The order changed; reload and try again");
        }
        if (current.status === "pending" && input.status === "delivered") {
          for (const item of current.items) {
            if (item.product_type !== "physical") continue;
            const reservation = item.inventory_reservation;
            if (!reservation || reservation.status !== "active") throw new ConflictException("Physical inventory reservation is no longer active");
            const committed = await transaction.inventory_reservations.updateMany({
              where: { id: reservation.id, status: "active" }, data: { status: "committed" }
            });
            if (committed.count !== 1) throw new ConflictException("Physical inventory reservation changed");
          }
        }
        if (input.status === "cancelled") {
          // Created attempts have never reached the provider. Closing them in the
          // same transaction frees their unique slot; the initiation claim locks
          // and checks this order, so it cannot charge after cancellation wins.
          await transaction.payment_attempts.updateMany({
            where: { status: "created", OR: [
              { order_id: orderId },
              ...(current.checkout_id ? [{ checkout_payment_group: { checkout_id: current.checkout_id } }] : [])
            ] },
            data: { status: "failed", failure_code: "ORDER_CANCELLED_BEFORE_INITIATION" }
          });
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
      return mapResult(order);
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
          const authorized = await this.prisma.orders.findFirst({ where: { ...scope, id: replay.order.id, trashed_at: null }, select: { id: true } });
          if (!authorized) throw new NotFoundException("Order was not found");
          return mapResult(replay.order);
        }
      }
      throw error;
    }
  }

  async setTrash(actor: AppUser, orderId: string, input: { trashed: boolean; confirm: boolean }, idempotencyKey: string) {
    if (!this.hasPlatformPermission(actor, "orders_manage")) throw new ForbiddenException("Platform order access is required");
    if (!input.confirm) throw new BadRequestException("Confirm this administrative action");
    const requestHash = this.hash({ orderId, trashed: input.trashed });
    try {
    const order = await this.serializable(async (tx) => {
      const replay = await tx.order_events.findUnique({
        where: { actor_user_id_idempotency_key: { actor_user_id: actor.id, idempotency_key: idempotencyKey } },
        select: { request_hash: true, order: { select: orderSelect } }
      });
      if (replay) {
        this.assertSameRequest(replay.request_hash, requestHash);
        return replay.order;
      }
      const current = await tx.orders.findUnique({ where: { id: orderId }, select: { id: true, status: true, trashed_at: true } });
      if (!current) throw new NotFoundException("Order was not found");
      if (Boolean(current.trashed_at) === input.trashed) throw new ConflictException("Order trash state has already changed");
      if (input.trashed && current.status !== "delivered" && current.status !== "cancelled") {
        throw new ConflictException("Only completed or cancelled orders can be moved to trash");
      }
      const changed = await tx.orders.updateMany({
        where: { id: orderId, status: current.status, trashed_at: input.trashed ? null : { not: null } },
        data: { trashed_at: input.trashed ? new Date() : null }
      });
      if (changed.count !== 1) throw new ConflictException("The order changed; reload and try again");
      await tx.order_events.create({ data: {
        order_id: orderId, actor_user_id: actor.id, from_status: current.status, to_status: current.status,
        action: input.trashed ? "trashed" : "restored", idempotency_key: idempotencyKey, request_hash: requestHash
      } });
      return tx.orders.findUniqueOrThrow({ where: { id: orderId }, select: orderSelect });
    });
    return this.mapForActor(order, actor);
    } catch (error) {
      if (this.isUniqueConflict(error)) {
        const replay = await this.prisma.order_events.findUnique({
          where: { actor_user_id_idempotency_key: { actor_user_id: actor.id, idempotency_key: idempotencyKey } },
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
      if (replay) {
        this.assertSameRequest(replay.request_hash, requestHash);
        const authorized = await tx.orders.findFirst({ where: { id: replay.order.id, seller_id: sellerId, trashed_at: null }, select: { id: true } });
        if (!authorized) throw new NotFoundException("Order was not found");
        return this.map(replay.order);
      }
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

  async claimDigitalDownload(actor: AppUser, orderId: string, itemId: string, clientIp: string, fileIndex = 0) {
    return this.prisma.$transaction(async (tx) => {
      const entitlement = await tx.digital_entitlements.findFirst({
        where: { order_item_id: itemId, file_index: fileIndex, buyer_id: actor.id, order_item: { order_id: orderId, order: { buyer_id: actor.id, status: { in: ["paid", "processing", "awaiting_confirmation", "delivered"] } } } },
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

  async digitalAccess(actor: AppUser, offerId: string) {
    if (actor.role !== "buyer") throw new ForbiddenException("Only buyers can access purchases");
    const itemWhere = {
      offer_id: offerId,
      product_type: "digital" as const,
      digital_entitlement: { some: { buyer_id: actor.id } }
    };
    const order = await this.prisma.orders.findFirst({
      where: {
        buyer_id: actor.id,
        status: { in: ["paid", "processing", "awaiting_confirmation", "delivered"] },
        items: { some: itemWhere }
      },
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
      select: {
        id: true,
        items: {
          where: itemWhere,
          orderBy: { id: "desc" },
          take: 1,
          select: {
            id: true,
            digital_entitlement: {
              where: { buyer_id: actor.id },
              orderBy: { file_index: "asc" },
              select: { file_index: true, delivery_url: true, max_downloads: true, download_count: true }
            }
          }
        }
      }
    });
    const item = order?.items[0];
    return item ? {
      orderId: order.id,
      itemId: item.id,
      files: mapDigitalDeliveries(order.id, item.id, item.digital_entitlement)
    } : { orderId: null, itemId: null, files: [] };
  }

  async freeDigitalDownload(actor: AppUser, offerId: string, clientIp: string, fileIndex = 0) {
    if (actor.role !== "buyer") throw new ForbiddenException("Only buyers can download files");
    const offer = await this.prisma.seller_offers.findFirst({
      where: {
        id: offerId,
        status: "active",
        price: new Prisma.Decimal(0),
        listing: {
          status: "active",
          seller: { invited: false, approved: true, suspended_at: null },
          product: { status: "active", type: "digital" }
        }
      },
      select: {
        currency: true,
        listing: { select: { product: { select: { price_currency: true } } } },
        digital: { select: { file_reference: true, file_references: true } }
      }
    });
    const file = offer?.digital && offer.currency.trim() === offer.listing.product.price_currency
      ? digitalFileReferences(offer.digital)[fileIndex] : undefined;
    if (!file) throw new NotFoundException("Free download was not found");
    try {
      return signUploadDownloadLink(
        file,
        clientIp,
        this.config?.get<string>("UPLOAD_DOWNLOAD_HOSTS") ?? "",
        this.config?.get<string>("UPLOAD_DOWNLOAD_SECRET") ?? ""
      );
    } catch {
      throw new ServiceUnavailableException("Digital delivery is not configured");
    }
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
    productType: product_type,
    payoutStatus?: string,
    purchase = actor.role === "buyer"
  ) {
    let allowed: boolean;
    if (purchase) {
      allowed =
        (from === "pending" && to === "cancelled") ||
        (productType === "digital" && from === "paid" && to === "delivered") ||
        (productType === "physical" && from === "shipped" && to === "delivered") ||
        (productType !== "physical" && from === "awaiting_confirmation" && to === "delivered");
    } else if (this.hasPlatformPermission(actor, "orders_manage")) {
      allowed = this.adminTransitions(from, productType, payoutStatus).includes(to);
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
      trashedAt: order.trashed_at?.toISOString() ?? null,
      currency: order.currency.trim(),
      totalAmount: order.total_amount.toString(),
      commissionRate: order.commission_rate.toString(),
      holdbackRate: order.holdback_rate.toString(),
      shippingAddress: order.shipping_address ? { recipientName: order.shipping_address.recipient_name, phoneNumber: order.shipping_address.phone_number, province: order.shipping_address.province, city: order.shipping_address.city, postalCode: order.shipping_address.postal_code.trim(), addressLine: order.shipping_address.address_line } : null,
      shipment: order.shipment ? { carrier: order.shipment.carrier, trackingCode: order.shipment.tracking_code, shippedAt: order.shipment.shipped_at.toISOString() } : null,
      shippingDispatch: order.shipping_dispatch ? this.mapShippingDispatch(order.shipping_dispatch) : null,
      amadastShipment: order.shipping_dispatch?.provider === "amadast" ? {
        externalOrderId: order.shipping_dispatch.id,
        status: order.shipping_dispatch.status,
        providerOrderId: order.shipping_dispatch.legacy_provider_order_id ?? this.numericReference(order.shipping_dispatch.provider_order_reference),
        amadastTrackingCode: order.shipping_dispatch.provider_tracking_code,
        courierTrackingCode: order.shipping_dispatch.courier_tracking_code,
        courierTitle: order.shipping_dispatch.courier_title,
        errorCode: order.shipping_dispatch.last_error_code,
        registeredAt: order.shipping_dispatch.registered_at?.toISOString() ?? null,
        trackingSyncedAt: order.shipping_dispatch.tracking_synced_at?.toISOString() ?? null
      } : null,
      items: order.items.map((item) => ({
        id: item.id,
        offerId: item.offer_id,
        productId: item.offer.listing.product_id,
        productType: item.product_type,
        productTitle: item.product_title,
        quantity: item.quantity,
        unitPrice: item.unit_price.toString(),
        totalAmount: item.total_amount.toString(),
        serviceNote: item.service_note,
        serviceInputs: this.mapServiceInputs(item, revealSensitiveServiceAnswers),
        digitalDelivery: mapDigitalDeliveries(order.id, item.id, item.digital_entitlement, item.digital_delivery_titles)[0] ?? null,
        digitalDeliveries: mapDigitalDeliveries(order.id, item.id, item.digital_entitlement, item.digital_delivery_titles),
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

  adminTransitions(from: order_status, productType: product_type, payoutStatus?: string): UpdateOrderStatusDto["status"][] {
    if (from === "cancelled") return [];
    if (from === "pending") return ["delivered", "cancelled"];
    if (from === "delivered") {
      if (payoutStatus && payoutStatus !== "draft") return [];
      return productType === "physical" ? ["shipped", "processing"] : ["awaiting_confirmation", "processing"];
    }
    if (from === "paid") return ["processing", "delivered"];
    if (from === "processing") return productType === "physical" ? ["shipped", "delivered"] : ["awaiting_confirmation", "delivered"];
    if (from === "shipped" || from === "awaiting_confirmation") return ["processing", "delivered"];
    return [];
  }

  private mapShippingDispatch(dispatch: OrderRecord["shipping_dispatch"] & {}) {
    return dispatch ? {
      externalOrderId: dispatch.id,
      provider: dispatch.provider,
      status: dispatch.status,
      providerOrderReference: dispatch.provider_order_reference ?? (dispatch.legacy_provider_order_id ? String(dispatch.legacy_provider_order_id) : null),
      providerTrackingCode: dispatch.provider_tracking_code,
      courierTrackingCode: dispatch.courier_tracking_code,
      courierTitle: dispatch.courier_title,
      errorCode: dispatch.last_error_code,
      registeredAt: dispatch.registered_at?.toISOString() ?? null,
      trackingSyncedAt: dispatch.tracking_synced_at?.toISOString() ?? null
    } : null;
  }

  private numericReference(value: string | null) {
    if (!value || !/^\d+$/.test(value)) return null;
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) ? parsed : null;
  }

  private mapForActor(order: OrderRecord, actor: AppUser) {
    const mapped = this.map(
      order,
      actor.role === "seller-admin" || actor.role === "seller-staff"
    );
    if (actor.role !== "buyer") return mapped;
    return this.mapForBuyer(order);
  }

  private mapForBuyer(order: OrderRecord) {
    const mapped = this.map(order);
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
