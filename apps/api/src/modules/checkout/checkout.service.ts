import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpStatus,
  Injectable,
  NotFoundException,
  ServiceUnavailableException
} from "@nestjs/common";
import type { AppUser, ProductType } from "@topgsm/shared-types";
import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "../../prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { PaymentApplicationService } from "../../integrations/payments/payment-application.service";
import { PaymentService } from "../../integrations/payments/payment.service";
import { PublicHttpException } from "../../common/http/public-http.exception";
import type { CreateCheckoutDto, QuoteCheckoutDto, ShippingAddressDto } from "./dto/checkout.dto";
import { UsdRateService } from "../usd-rate/usd-rate.service";

const RESERVATION_MS = 15 * 60 * 1000;

const checkoutSelect = {
  id: true,
  status: true,
  currency: true,
  total_amount: true,
  expires_at: true,
  created_at: true,
  orders: {
    orderBy: [{ created_at: "asc" }, { id: "asc" }],
    select: {
      id: true,
      status: true,
      seller_id: true,
      total_amount: true,
      seller: { select: { shop_name: true } },
      shipping_address: {
        select: {
          recipient_name: true,
          phone_number: true,
          province: true,
          city: true,
          postal_code: true,
          address_line: true
        }
      },
      shipment: { select: { carrier: true, tracking_code: true, shipped_at: true } },
      items: {
        orderBy: { id: "asc" },
        select: {
          id: true,
          offer_id: true,
          product_type: true,
          product_title: true,
          quantity: true,
          unit_price: true,
          total_amount: true,
          service_note: true,
          digital_entitlement: { select: { id: true, max_downloads: true, download_count: true, delivery_url: true } }
        }
      }
    }
  },
  payment_groups: {
    orderBy: [{ created_at: "asc" }, { id: "asc" }],
    select: {
      id: true,
      provider: true,
      status: true,
      amount: true,
      currency: true,
      expires_at: true,
      orders: { select: { order_id: true } },
      attempts: {
        orderBy: { created_at: "desc" },
        take: 1,
        select: { status: true, authority: true, failure_code: true }
      }
    }
  }
} satisfies Prisma.checkoutsSelect;

type CheckoutRecord = Prisma.checkoutsGetPayload<{ select: typeof checkoutSelect }>;
type DbClient = Prisma.TransactionClient | PrismaService;
type InternalQuoteLine = {
  offerId: string; productId: string; title: string; productType: ProductType; quantity: number;
  image: { url: string; width: number; height: number } | null;
  unitPrice: string; totalAmount: string; availableStock: number | null; serviceNote: string | null;
  digitalDeliveryUrl: string | null; digitalMaxDownloads: number | null;
};

@Injectable()
export class CheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentService,
    private readonly paymentApplication: PaymentApplicationService,
    private readonly usdRates: UsdRateService
  ) {}

  async quote(input: QuoteCheckoutDto) {
    const descriptors = (await this.payments.listProviders()).filter((provider) => provider.available);
    const quote = await this.buildQuote(this.prisma, input, descriptors.map((provider) => ({ code: provider.code, name: provider.name })));
    return {
      ...quote,
      groups: quote.groups.map(({ commissionRate: _commission, holdbackRate: _holdback, total: _total, ...group }) => ({
        ...group,
        items: group.items.map(({ digitalDeliveryUrl: _url, digitalMaxDownloads: _limit, ...item }) => item)
      }))
    };
  }

  async create(actor: AppUser, input: CreateCheckoutDto, idempotencyKey: string) {
    if (actor.role !== "buyer") throw new ForbiddenException("Only buyers can create checkouts");
    const requestHash = this.hash({
      items: [...input.items].sort((a, b) => a.offerId.localeCompare(b.offerId)),
      shippingAddress: input.shippingAddress ?? null,
      paymentSelections: [...input.paymentSelections].sort((a, b) => a.orderGroupKey.localeCompare(b.orderGroupKey))
    });
    const existing = await this.prisma.checkouts.findUnique({
      where: { buyer_id_idempotency_key: { buyer_id: actor.id, idempotency_key: idempotencyKey } },
      select: { ...checkoutSelect, request_hash: true }
    });
    if (existing) {
      if (existing.request_hash !== requestHash) throw new ConflictException("Idempotency-Key was already used for another checkout");
      return this.map(existing);
    }

    const descriptors = (await this.payments.listProviders()).filter((provider) => provider.available);
    if (!descriptors.length) throw new ServiceUnavailableException("No payment method is currently available");
    const providerNames = descriptors.map((provider) => ({ code: provider.code, name: provider.name }));
    const expiresAt = new Date(Date.now() + RESERVATION_MS);

    try {
      const checkout = await this.serializable(async (tx) => {
        const quote = await this.buildQuote(tx, input, providerNames);
        const physical = quote.groups.some((group) => group.productType === "physical");
        if (physical && !input.shippingAddress) throw new BadRequestException("A shipping address is required");
        const selections = new Map(input.paymentSelections.map((selection) => [selection.orderGroupKey, selection.providerCode]));
        if (selections.size !== quote.groups.length) throw new BadRequestException("Choose a payment method for every order group");
        for (const group of quote.groups) {
          const provider = selections.get(group.key);
          if (!provider || !group.paymentMethods.some((method) => method.code === provider)) {
            throw new BadRequestException(`The selected payment method is unavailable for ${group.key}`);
          }
        }

        const createdCheckout = await tx.checkouts.create({
          data: {
            buyer_id: actor.id,
            currency: "TOMAN",
            total_amount: new Prisma.Decimal(quote.totalAmount),
            idempotency_key: idempotencyKey,
            request_hash: requestHash,
            expires_at: expiresAt
          }
        });

        const ordersByGroup = new Map<string, { id: string; amount: Prisma.Decimal }>();
        for (const group of quote.groups) {
          for (const line of group.items) {
            if (line.productType === "physical") {
              const reserved = await tx.seller_offer_physical.updateMany({
                where: { offer_id: line.offerId, stock: { gte: line.quantity } },
                data: { stock: { decrement: line.quantity } }
              });
              if (reserved.count !== 1) throw new ConflictException(`${line.title} no longer has enough stock`);
            }
          }
          const gross = new Prisma.Decimal(group.totalAmount);
          const commission = gross.mul(group.commissionRate).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
          const holdback = gross.mul(group.holdbackRate).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
          const orderKey = randomUUID();
          const order = await tx.orders.create({
            data: {
              buyer_id: actor.id,
              seller_id: group.seller.id,
              checkout_id: createdCheckout.id,
              traffic_source: input.trafficSource ?? null,
              status: "pending",
              currency: "TOMAN",
              total_amount: gross,
              commission_rate: new Prisma.Decimal(group.commissionRate),
              holdback_rate: new Prisma.Decimal(group.holdbackRate),
              idempotency_key: orderKey,
              request_hash: this.hash({ checkoutId: createdCheckout.id, group: group.key }),
              ...(group.productType === "physical" && input.shippingAddress
                ? { shipping_address: { create: this.shippingData(input.shippingAddress) } }
                : {}),
              payout_records: {
                create: {
                  gross_amount: gross,
                  commission_amount: commission,
                  holdback_amount: holdback,
                  payable_amount: gross.minus(commission).minus(holdback),
                  currency: "TOMAN"
                }
              }
            },
            select: { id: true, total_amount: true }
          });
          await tx.order_items.createMany({ data: group.items.map((line) => ({
            order_id: order.id, offer_id: line.offerId, product_type: line.productType, product_title: line.title,
            quantity: line.quantity, unit_price: new Prisma.Decimal(line.unitPrice), total_amount: new Prisma.Decimal(line.totalAmount),
            service_note: line.serviceNote || null, digital_delivery_url: line.digitalDeliveryUrl, digital_max_downloads: line.digitalMaxDownloads
          })) });
          await tx.order_events.create({
            data: { order_id: order.id, actor_user_id: actor.id, from_status: null, to_status: "pending", idempotency_key: orderKey, request_hash: this.hash({ checkoutId: createdCheckout.id, group: group.key }) }
          });
          await tx.outbox_events.create({
            data: { aggregate: "order", aggregate_id: order.id, event_type: "order.created", dedupe_key: `order.created:${order.id}`, payload: { orderId: order.id, buyerId: actor.id, sellerId: group.seller.id, checkoutId: createdCheckout.id, status: "pending" } }
          });
          const physicalItems = await tx.order_items.findMany({ where: { order_id: order.id, product_type: "physical" }, select: { id: true, offer_id: true, quantity: true } });
          if (physicalItems.length) {
            await tx.inventory_reservations.createMany({
              data: physicalItems.map((item) => ({ order_item_id: item.id, offer_id: item.offer_id, quantity: item.quantity, expires_at: expiresAt }))
            });
          }
          ordersByGroup.set(group.key, { id: order.id, amount: order.total_amount });
        }

        const byProvider = new Map<string, Array<{ id: string; amount: Prisma.Decimal }>>();
        for (const [key, order] of ordersByGroup) {
          const provider = selections.get(key)!;
          byProvider.set(provider, [...(byProvider.get(provider) ?? []), order]);
        }
        for (const [provider, orders] of byProvider) {
          const amount = orders.reduce((sum, order) => sum.add(order.amount), new Prisma.Decimal(0));
          await tx.checkout_payment_groups.create({
            data: {
              checkout_id: createdCheckout.id,
              provider,
              amount,
              currency: "TOMAN",
              expires_at: expiresAt,
              orders: { create: orders.map((order) => ({ order_id: order.id, amount: order.amount })) }
            }
          });
        }
        return tx.checkouts.findUniqueOrThrow({ where: { id: createdCheckout.id }, select: checkoutSelect });
      });
      return this.map(checkout);
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        const replay = await this.prisma.checkouts.findUnique({
          where: { buyer_id_idempotency_key: { buyer_id: actor.id, idempotency_key: idempotencyKey } },
          select: { ...checkoutSelect, request_hash: true }
        });
        if (replay && replay.request_hash === requestHash) return this.map(replay);
      }
      throw error;
    }
  }

  async get(actor: AppUser, checkoutId: string) {
    if (actor.role !== "buyer") throw new ForbiddenException("Only buyers can view checkouts");
    const checkout = await this.prisma.checkouts.findFirst({ where: { id: checkoutId, buyer_id: actor.id }, select: checkoutSelect });
    if (!checkout) throw new NotFoundException("Checkout was not found");
    return this.map(checkout);
  }

  async initiate(actor: AppUser, checkoutId: string, groupId: string, idempotencyKey: string) {
    return this.paymentApplication.initiateCheckoutGroup(actor, checkoutId, groupId, idempotencyKey);
  }

  private async buildQuote(db: DbClient, input: QuoteCheckoutDto, providers: Array<{ code: string; name: string }>) {
    const offerIds = input.items.map((line) => line.offerId);
    const offers = await db.seller_offers.findMany({
      where: {
        id: { in: offerIds }, status: "active",
        listing: { status: "active", product: { status: "active", type: { not: "bridge" } }, seller: { invited: false, approved: true, suspended_at: null } }
      },
      select: {
        id: true, price: true, currency: true,
        digital: { select: { file_reference: true, max_downloads: true } },
        physical: { select: { stock: true } },
        listing: {
          select: {
            seller: { select: { id: true, shop_name: true, commission: true, holdback_rate: true, permissions: { where: { permission: "physical_products_manage" }, select: { permission: true } } } },
            product: {
              select: {
                id: true,
                title: true,
                type: true,
                media: {
                  select: {
                    id: true,
                    variants: {
                      orderBy: { variant: "desc" },
                      select: { variant: true, width: true, height: true }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });
    if (offers.length !== offerIds.length) {
      const availableOfferIds = new Set(offers.map((offer) => offer.id));
      throw new PublicHttpException(HttpStatus.CONFLICT, "One or more cart items are unavailable", {
        code: "CART_ITEMS_UNAVAILABLE",
        offerIds: offerIds.filter((offerId) => !availableOfferIds.has(offerId))
      });
    }
    const currencies = new Set(offers.map((offer) => offer.currency.trim()));
    if ([...currencies].some((currency) => currency !== "TOMAN" && currency !== "USD")) {
      throw new BadRequestException("Only toman and USD offers can be purchased");
    }
    const tomanPerUsd = currencies.has("USD") ? await this.usdRates.getTomanPerUsd(db) : null;
    const configs = await db.payment_method_configs.findMany({
      where: { enabled: true, provider_code: { in: providers.map((provider) => provider.code) } },
      select: { provider_code: true, seller_rules: { select: { seller_id: true } }, product_type_rules: { select: { product_type: true } } }
    });
    const configByCode = new Map(configs.map((config) => [config.provider_code, config]));
    const offerById = new Map(offers.map((offer) => [offer.id, offer]));
    const groups = new Map<string, {
      key: string; seller: { id: string; shopName: string }; productType: ProductType;
      commissionRate: string; holdbackRate: string; items: InternalQuoteLine[]; total: Prisma.Decimal;
    }>();
    for (const requested of input.items) {
      const offer = offerById.get(requested.offerId)!;
      const type = offer.listing.product.type as ProductType;
      const offerCurrency = offer.currency.trim();
      if (offerCurrency === "TOMAN" && !offer.price.isInteger()) {
        throw new BadRequestException("Toman offers must use integer prices");
      }
      if (type === "physical" && (offer.physical?.stock ?? 0) < requested.quantity) {
        throw new PublicHttpException(HttpStatus.CONFLICT, `${offer.listing.product.title} does not have enough stock`, {
          code: "CART_STOCK_INSUFFICIENT",
          offerIds: [offer.id]
        });
      }
      if (type === "physical" && offer.listing.seller.permissions.length === 0) {
        throw new PublicHttpException(HttpStatus.CONFLICT, `${offer.listing.product.title} is not currently available for physical delivery`, {
          code: "CART_ITEMS_UNAVAILABLE",
          offerIds: [offer.id]
        });
      }
      if (type === "digital" && (!offer.digital || !this.isHttpsUrl(offer.digital.file_reference))) {
        throw new PublicHttpException(HttpStatus.CONFLICT, `${offer.listing.product.title} has no valid HTTPS delivery URL`, {
          code: "CART_ITEMS_UNAVAILABLE",
          offerIds: [offer.id]
        });
      }
      if (type !== "service" && requested.serviceNote?.trim()) throw new BadRequestException("Only service products accept a customer note");
      const key = `${offer.listing.seller.id}:${type}`;
      const group = groups.get(key) ?? {
        key, seller: { id: offer.listing.seller.id, shopName: offer.listing.seller.shop_name }, productType: type,
        commissionRate: offer.listing.seller.commission.toString(), holdbackRate: offer.listing.seller.holdback_rate.toString(), items: [], total: new Prisma.Decimal(0)
      };
      const unitPrice = offerCurrency === "USD"
        ? offer.price.mul(tomanPerUsd!).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP)
        : offer.price;
      const total = unitPrice.mul(requested.quantity);
      group.items.push({
        offerId: offer.id, productId: offer.listing.product.id, title: offer.listing.product.title,
        image: this.mapCheckoutImage(offer.listing.product.media),
        productType: type, quantity: requested.quantity, unitPrice: unitPrice.toString(), totalAmount: total.toString(),
        availableStock: offer.physical?.stock ?? null, serviceNote: requested.serviceNote?.trim() || null,
        digitalDeliveryUrl: offer.digital?.file_reference ?? null,
        digitalMaxDownloads: offer.digital?.max_downloads ?? null
      });
      group.total = group.total.add(total);
      groups.set(key, group);
    }
    const quotedGroups = [...groups.values()].sort((a, b) => a.key.localeCompare(b.key)).map((group) => {
      const methods = providers.filter((provider) => {
        const config = configByCode.get(provider.code);
        if (!config) return false;
        const sellerAllowed = config.seller_rules.length === 0 || config.seller_rules.some((rule) => rule.seller_id === group.seller.id);
        const typeAllowed = config.product_type_rules.length === 0 || config.product_type_rules.some((rule) => rule.product_type === group.productType);
        return sellerAllowed && typeAllowed;
      });
      return { ...group, items: group.items, totalAmount: group.total.toString(), paymentMethods: methods };
    });
    if (quotedGroups.some((group) => group.paymentMethods.length === 0)) throw new ServiceUnavailableException("One or more seller groups have no available payment method");
    const commonPaymentMethods = providers.filter((provider) => quotedGroups.every((group) => group.paymentMethods.some((method) => method.code === provider.code)));
    const total = quotedGroups.reduce((sum, group) => sum.add(group.total), new Prisma.Decimal(0));
    return { currency: "TOMAN", totalAmount: total.toString(), groups: quotedGroups, commonPaymentMethods, requiresShippingAddress: quotedGroups.some((group) => group.productType === "physical") };
  }

  private mapCheckoutImage(
    media: { id: string; variants: Array<{ variant: string; width: number; height: number }> } | null
  ) {
    const variant = media?.variants.find((item) => item.variant === "thumb")
      ?? media?.variants.find((item) => item.variant === "large");
    return media && variant
      ? { url: `/media/${media.id}/${variant.variant}.webp`, width: variant.width, height: variant.height }
      : null;
  }

  private shippingData(address: ShippingAddressDto) {
    return {
      recipient_name: address.recipientName.trim(), phone_number: this.normalizeIranianPhone(address.phoneNumber),
      province: address.province.trim(), city: address.city.trim(), postal_code: address.postalCode,
      address_line: address.addressLine.trim()
    };
  }

  private normalizeIranianPhone(value: string) {
    const digits = value.replace(/^0098/, "+98").replace(/^98/, "+98").replace(/^0/, "+98");
    return digits;
  }

  private isHttpsUrl(value: string) {
    try { return new URL(value).protocol === "https:"; } catch { return false; }
  }

  private hash(value: unknown) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }

  private async serializable<T>(work: (tx: Prisma.TransactionClient) => Promise<T>) {
    for (let attempt = 0; ; attempt += 1) {
      try { return await this.prisma.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }); }
      catch (error) {
        if (attempt >= 2 || !(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2034") throw error;
      }
    }
  }

  private map(checkout: CheckoutRecord) {
    return {
      id: checkout.id, status: checkout.status, currency: checkout.currency.trim(), totalAmount: checkout.total_amount.toString(),
      expiresAt: checkout.expires_at.toISOString(), createdAt: checkout.created_at.toISOString(),
      orders: checkout.orders.map((order) => ({
        id: order.id, status: order.status, seller: { id: order.seller_id, shopName: order.seller.shop_name }, totalAmount: order.total_amount.toString(),
        shippingAddress: order.shipping_address ? {
          recipientName: order.shipping_address.recipient_name, phoneNumber: order.shipping_address.phone_number,
          province: order.shipping_address.province, city: order.shipping_address.city, postalCode: order.shipping_address.postal_code.trim(), addressLine: order.shipping_address.address_line
        } : null,
        shipment: order.shipment ? { carrier: order.shipment.carrier, trackingCode: order.shipment.tracking_code, shippedAt: order.shipment.shipped_at.toISOString() } : null,
        items: order.items.map((item) => ({
          id: item.id, offerId: item.offer_id, productType: item.product_type, productTitle: item.product_title,
          quantity: item.quantity, unitPrice: item.unit_price.toString(), totalAmount: item.total_amount.toString(), serviceNote: item.service_note,
          digitalDelivery: item.digital_entitlement ? {
            downloadUrl: `/orders/${order.id}/items/${item.id}/download`, destinationHost: new URL(item.digital_entitlement.delivery_url).hostname,
            maxDownloads: item.digital_entitlement.max_downloads, downloadCount: item.digital_entitlement.download_count
          } : null
        }))
      })),
      paymentGroups: checkout.payment_groups.map((group) => ({
        id: group.id, provider: group.provider, status: group.status, amount: group.amount.toString(), currency: group.currency.trim(),
        orderIds: group.orders.map((order) => order.order_id), expiresAt: group.expires_at.toISOString(), latestAttempt: group.attempts[0] ?? null
      }))
    };
  }
}
