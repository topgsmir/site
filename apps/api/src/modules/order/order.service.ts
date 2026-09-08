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
import { Prisma, order_status, product_type } from "@prisma/client";
import type { AppUser } from "@topgsm/shared-types";
import { createHash, randomUUID } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { CredentialCryptoService } from "../bridge/credential-crypto.service";
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
      total_amount: true,
      bridge_fulfillment: {
        select: { id: true, mode: true, status: true, last_error_code: true, completed_at: true, encrypted_input: true, encryption_key_id: true, encrypted_result: true, result_encryption_key_id: true }
      }
    }
  }
});

type OrderRecord = Prisma.ordersGetPayload<{ select: typeof orderSelect }>;

@Injectable()
export class OrderService {
  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly crypto?: CredentialCryptoService,
    @Optional() private readonly config?: ConfigService
  ) {}

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
    await this.auditBridgeAccess(actor.id, page, "list");
    return {
      items: page.map((order) => this.map(order)),
      nextCursor: hasMore ? page.at(-1)?.id ?? null : null
    };
  }

  async get(actor: AppUser, orderId: string) {
    const where = await this.scope(actor);
    const order = await this.prisma.orders.findFirst({ where: { ...where, id: orderId }, select: orderSelect });
    if (!order) throw new NotFoundException("Order was not found");
    await this.auditBridgeAccess(actor.id, [order], "detail");
    return this.map(order);
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
                total_amount: gross,
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
            ...(actor.role === "platform-admin"
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
    if (actor.role === "platform-admin") return {};
    if (actor.role === "buyer") return { buyer_id: actor.id };
    const sellerId = await this.sellerIdFor(actor, "orders_manage");
    return { seller_id: sellerId ?? "" };
  }

  private async sellerIdFor(
    actor: AppUser,
    permission: "orders_manage" | "payouts_request"
  ) {
    if (actor.role === "platform-admin" || actor.role === "buyer") return null;
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
    let allowed = false;
    if (actor.role === "platform-admin") {
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
        totalAmount: item.total_amount.toString(),
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

  private decryptBridgeValue(ciphertext: string, keyId: string, purpose: string) {
    if (!this.crypto) return null;
    try { return JSON.parse(this.crypto.decrypt(ciphertext, keyId, purpose)) as unknown; }
    catch { return null; }
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
