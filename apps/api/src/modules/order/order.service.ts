import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { Prisma, order_status, product_type } from "@prisma/client";
import type { AppUser } from "@topgsm/shared-types";
import { createHash } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service";
import type {
  CreateOrderDto,
  ListOrdersQueryDto,
  UpdateOrderStatusDto
} from "./dto/order.dto";

const orderSelect = Prisma.validator<Prisma.ordersSelect>()({
  id: true,
  buyer_id: true,
  seller_id: true,
  status: true,
  currency: true,
  total_amount: true,
  commission_rate: true,
  holdback_rate: true,
  created_at: true,
  updated_at: true,
  seller: { select: { shop_name: true } },
  items: {
    select: {
      offer_id: true,
      product_type: true,
      product_title: true,
      quantity: true,
      unit_price: true,
      total_amount: true
    }
  }
});

type OrderRecord = Prisma.ordersGetPayload<{ select: typeof orderSelect }>;

@Injectable()
export class OrderService {
  constructor(private readonly prisma: PrismaService) {}

  async list(actor: AppUser, input: ListOrdersQueryDto) {
    const where = await this.scope(actor);
    if (input.cursor) {
      const cursor = await this.prisma.orders.findFirst({
        where: { ...where, id: input.cursor },
        select: { id: true }
      });
      if (!cursor) throw new NotFoundException("Order page cursor was not found");
    }
    const rows = await this.prisma.orders.findMany({
      where,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      take: input.limit + 1,
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
      select: orderSelect
    });
    const hasMore = rows.length > input.limit;
    const page = hasMore ? rows.slice(0, input.limit) : rows;
    return {
      items: page.map((order) => this.map(order)),
      nextCursor: hasMore ? page.at(-1)?.id ?? null : null
    };
  }

  async create(actor: AppUser, input: CreateOrderDto, idempotencyKey: string) {
    if (actor.role !== "buyer") {
      throw new ForbiddenException("Only buyers can create orders");
    }
    const requestHash = this.hash({ offerId: input.offerId, quantity: input.quantity });

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
                product: { select: { title: true, type: true } }
              }
            }
          }
        });
        if (!offer) throw new NotFoundException("Offer was not found");

        const currency = offer.currency.trim();
        if (currency !== "IRR" || !offer.price.isInteger()) {
          throw new BadRequestException("The offer currency or precision is unsupported");
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

        const gross = offer.price.mul(input.quantity);
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
                unit_price: offer.price,
                total_amount: gross
              }
            },
            payout_records: {
              create: {
                seller_id: offer.listing.seller.id,
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
      return this.map(order);
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
          return this.map(replay);
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
          select: { ...orderSelect, items: { select: { product_type: true } } }
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
      return this.map(order);
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
          return this.map(replay.order);
        }
      }
      throw error;
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
    const seller = await this.prisma.sellers.findFirst({
      where: {
        user_id: actor.id,
        invited: false,
        approved: true,
        suspended_at: null,
        permissions: { some: { permission } }
      },
      select: { id: true }
    });
    if (!seller) throw new ForbiddenException(`Active seller ${permission} permission is required`);
    return seller.id;
  }

  private assertTransition(
    actor: AppUser,
    from: order_status,
    to: UpdateOrderStatusDto["status"],
    productType: product_type
  ) {
    let allowed = false;
    if (this.hasPlatformPermission(actor, "orders_manage")) {
      allowed = to === "cancelled" && from !== "cancelled" && from !== "delivered";
    } else if (actor.role === "buyer") {
      allowed =
        (from === "pending" && to === "cancelled") ||
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

  private map(order: OrderRecord) {
    return {
      id: order.id,
      buyerId: order.buyer_id,
      seller: { id: order.seller_id, shopName: order.seller.shop_name },
      status: order.status,
      currency: order.currency.trim(),
      totalAmount: order.total_amount.toString(),
      commissionRate: order.commission_rate.toString(),
      holdbackRate: order.holdback_rate.toString(),
      items: order.items.map((item) => ({
        offerId: item.offer_id,
        productType: item.product_type,
        productTitle: item.product_title,
        quantity: item.quantity,
        unitPrice: item.unit_price.toString(),
        totalAmount: item.total_amount.toString()
      })),
      createdAt: order.created_at.toISOString(),
      updatedAt: order.updated_at.toISOString()
    };
  }
}
