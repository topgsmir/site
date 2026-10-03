import { mapDigitalDeliveries, digitalFileReferences, digitalFileTitles } from "../order/digital-delivery";
import {
  BadRequestException,
  ConflictException,
  HttpStatus,
  Injectable,
  NotFoundException,
  Optional,
  ServiceUnavailableException
} from "@nestjs/common";
import type { AppUser, ProductType, ServiceInputDefinition } from "@topgsm/shared-types";
import { sellerCommissionRate } from "../seller/seller-commission";
import { createHash, randomUUID } from "node:crypto";
import { Prisma } from "../../prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { PaymentApplicationService } from "../../integrations/payments/payment-application.service";
import { PaymentService } from "../../integrations/payments/payment.service";
import { PublicHttpException } from "../../common/http/public-http.exception";
import type { CreateCheckoutDto, QuoteCheckoutDto, ShippingAddressDto } from "./dto/checkout.dto";
import { UsdRateService } from "../usd-rate/usd-rate.service";
import { CredentialCryptoService } from "../../common/security/credential-crypto.service";
import { ShippingTenantService } from "../../integrations/shipping/shipping-tenant.service";
import { ShippingPolicyService } from "../../integrations/shipping/shipping-policy.service";
import { ShippingProviderRegistry } from "../../integrations/shipping/shipping-provider.registry";
import { normalizeShippingPlace } from "../../integrations/shipping/shipping-place-name";
import type { CheckoutShippingPlacesDto } from "./dto/checkout.dto";
import { checkoutShippingSettlement } from "./checkout-shipping-settlement";
import { ClubService } from "../club/club.service";

const RESERVATION_MS = 15 * 60 * 1000;
const WALLET_METHOD = { code: "wallet", name: "Wallet" };

const checkoutSelect = {
  id: true,
  status: true,
  currency: true,
  total_amount: true,
  discount_amount: true,
  coupon: { select: { code: true } },
  expires_at: true,
  created_at: true,
  orders: {
    orderBy: [{ created_at: "asc" }, { id: "asc" }],
    select: {
      id: true,
      status: true,
      seller_id: true,
      total_amount: true,
      shipping_cost: true,
      shipping_fee: true,
      shipping_payer: true,
      discount_amount: true,
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
          digital_delivery_titles: true,
          digital_entitlement: { orderBy: { file_index: "asc" }, select: { file_index: true, id: true, max_downloads: true, download_count: true, delivery_url: true } }
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
      wallet_amount: true,
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
  serviceInputs: ServiceInputDefinition[]; serviceAnswers: Array<{ key: string; value: string }>;
  digitalDeliveryUrl: string | null; digitalDeliveryUrls: string[]; digitalDeliveryTitles: string[]; digitalMaxDownloads: number | null;
  parcel: { weightGrams: number; lengthCm: number | null; widthCm: number | null; heightCm: number | null } | null;
};

@Injectable()
export class CheckoutService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly payments: PaymentService,
    private readonly paymentApplication: PaymentApplicationService,
    private readonly usdRates: UsdRateService,
    private readonly shippingTenants: ShippingTenantService,
    private readonly shippingPolicy: ShippingPolicyService,
    private readonly shippingProviders: ShippingProviderRegistry,
    @Optional() private readonly crypto?: CredentialCryptoService,
    @Optional() private readonly club?: ClubService
  ) {}

  async shippingPlaces(input: CheckoutShippingPlacesDto) {
    const offerIds = input.items.map((item) => item.offerId);
    const offers = await this.prisma.seller_offers.findMany({
      where: {
        id: { in: offerIds },
        status: "active",
        listing: {
          status: "active",
          product: { status: "active", type: "physical" },
          seller: {
            invited: false,
            approved: true,
            suspended_at: null,
            permissions: { some: { permission: "physical_products_manage" } },
            shipping_profile: { is: { enabled: true, latitude: { not: null }, longitude: { not: null } } }
          }
        }
      },
      select: { id: true, listing: { select: { seller_id: true } } }
    });
    if (offers.length !== offerIds.length) {
      throw new BadRequestException("A valid physical cart with configured shipping is required");
    }
    if (!await this.shippingProviders.active().isConfigured()) {
      throw new ServiceUnavailableException("Postal shipping is not configured");
    }
    const sellerIds = [...new Set(offers.map((offer) => offer.listing.seller_id))].sort();
    const sellerId = sellerIds[0];
    if (!sellerId) throw new BadRequestException("A physical cart is required");
    const places = await this.shippingTenants.listPlacesForConfiguredSeller({ sellerId, provinceId: input.provinceId });
    if (input.provinceId != null) return places;
    const policy = await this.shippingPolicy.effective(this.prisma);
    const rules = sellerIds.map((id) => this.shippingPolicy.rule(policy, id));
    return places.filter((place) => rules.every((rule) => !rule.allowedProvinces.length || rule.allowedProvinces.some((name) => normalizeShippingPlace(name) === normalizeShippingPlace(place.title))));
  }

  async quote(input: QuoteCheckoutDto, buyerId?: string) {
    const descriptors = (await this.payments.listProviders()).filter((provider) => provider.available);
    const quote = await this.buildQuote(this.prisma, input, [...descriptors.map((provider) => ({ code: provider.code, name: provider.name })), WALLET_METHOD], false, buyerId);
    return {
      currency: quote.currency,
      totalAmount: quote.totalAmount,
      discountAmount: quote.discountAmount,
      clubDiscountAmount: quote.clubDiscountAmount,
      clubPoints: quote.clubPoints,
      couponCode: quote.couponCode,
      usdToTomanRate: quote.usdToTomanRate,
      commonPaymentMethods: quote.commonPaymentMethods,
      requiresShippingAddress: quote.requiresShippingAddress,
      groups: quote.groups.map(({ commissionRate: _commission, total: _total, ...group }) => ({
        ...group,
        items: group.items.map(({ digitalDeliveryUrl: _url, digitalDeliveryUrls: _urls, digitalDeliveryTitles: _titles, digitalMaxDownloads: _limit, serviceAnswers: _answers, parcel: _parcel, ...item }) => item)
      }))
    };
  }

  async create(actor: AppUser, input: CreateCheckoutDto, idempotencyKey: string) {
    const requestHash = this.hash({
      items: [...input.items].sort((a, b) => a.offerId.localeCompare(b.offerId)),
      expectedTotalAmount: input.expectedTotalAmount ?? null,
      couponCode: input.couponCode?.normalize("NFKC").trim().toUpperCase() ?? null,
      clubPoints: input.clubPoints ?? 0,
      clubRewardId: input.clubRewardId ?? null,
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
    const providerNames = [...descriptors.map((provider) => ({ code: provider.code, name: provider.name })), WALLET_METHOD];
    const expiresAt = new Date(Date.now() + RESERVATION_MS);

    try {
      const checkout = await this.serializable(async (tx) => {
        const quote = await this.buildQuote(tx, input, providerNames, true, actor.id);
        if (input.expectedTotalAmount != null && quote.totalAmount !== input.expectedTotalAmount) throw new ConflictException("Checkout total changed; review the updated quote");
        if (quote.couponId) {
          const reserved = await tx.$executeRaw`
            UPDATE "coupons" SET "redeemed_count" = "redeemed_count" + 1
            WHERE "id" = ${quote.couponId} AND "active" = true
              AND "starts_at" <= statement_timestamp() AND ("expires_at" IS NULL OR "expires_at" > statement_timestamp())
              AND ("maximum_redemptions" IS NULL OR "redeemed_count" < "maximum_redemptions")`;
          if (reserved !== 1) throw new ConflictException("Coupon is no longer available");
        }
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
            discount_amount: new Prisma.Decimal(quote.discountAmount),
            coupon_id: quote.couponId,
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
          const { gross, commission, sellerShippingCost, payable } = checkoutShippingSettlement({ ...group, totalAmount: new Prisma.Decimal(group.totalAmount).add(group.clubDiscountAmount).toString() });
          const orderKey = randomUUID();
          const order = await tx.orders.create({
            data: {
              buyer_id: actor.id,
              seller_id: group.seller.id,
              checkout_id: createdCheckout.id,
              traffic_source: input.trafficSource ?? null,
              status: "pending",
              currency: "TOMAN",
              total_amount: new Prisma.Decimal(group.totalAmount),
              shipping_cost: new Prisma.Decimal(group.shippingCost),
              shipping_fee: new Prisma.Decimal(group.shippingFee),
              shipping_payer: group.shippingPayer,
              discount_amount: new Prisma.Decimal(group.discountAmount),
              coupon_id: new Prisma.Decimal(group.discountAmount).minus(group.clubDiscountAmount).gt(0) ? quote.couponId : null,
              commission_rate: new Prisma.Decimal(group.commissionRate),
              idempotency_key: orderKey,
              request_hash: this.hash({ checkoutId: createdCheckout.id, group: group.key }),
              ...(group.productType === "physical" && input.shippingAddress
                ? { shipping_address: { create: this.shippingData(input.shippingAddress) } }
                : {}),
              payout_records: {
                create: {
                  gross_amount: gross,
                  commission_amount: commission,
                  shipping_cost_amount: sellerShippingCost,
                  payable_amount: payable,
                  currency: "TOMAN"
                }
              }
            },
            select: { id: true, total_amount: true }
          });
          await tx.order_items.createMany({ data: group.items.map((line) => {
            const itemId = randomUUID();
            const encryptedAnswers = this.encryptServiceAnswers(itemId, line.serviceAnswers);
            return {
              id: itemId,
              order_id: order.id, offer_id: line.offerId, product_type: line.productType, product_title: line.title,
              quantity: line.quantity, unit_price: new Prisma.Decimal(line.unitPrice), total_amount: new Prisma.Decimal(line.totalAmount),
              shipping_weight_grams: line.parcel?.weightGrams ?? null,
              shipping_length_cm: line.parcel?.lengthCm ?? null,
              shipping_width_cm: line.parcel?.widthCm ?? null,
              shipping_height_cm: line.parcel?.heightCm ?? null,
              service_note: line.serviceNote || null,
              service_input_schema: line.serviceInputs as unknown as Prisma.InputJsonValue,
              encrypted_service_answers: encryptedAnswers?.ciphertext ?? null,
              service_answers_key_id: encryptedAnswers?.keyId ?? null,
              digital_delivery_url: line.digitalDeliveryUrl, digital_delivery_urls: line.digitalDeliveryUrls, digital_delivery_titles: line.digitalDeliveryTitles, digital_max_downloads: line.digitalMaxDownloads
            };
          }) });
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

        if (quote.clubPoints) {
          if (!this.club) throw new ServiceUnavailableException("Club ledger unavailable");
          await this.club.reserveCheckout(tx, createdCheckout.id, actor.id, quote.clubAllocation, ordersByGroup);
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
    const checkout = await this.prisma.checkouts.findFirst({ where: { id: checkoutId, buyer_id: actor.id }, select: checkoutSelect });
    if (!checkout) throw new NotFoundException("Checkout was not found");
    return this.map(checkout);
  }

  async initiate(actor: AppUser, checkoutId: string, groupId: string, idempotencyKey: string, walletAmount = "0") {
    return this.paymentApplication.initiateCheckoutGroup(actor, checkoutId, groupId, idempotencyKey, walletAmount);
  }

  private async buildQuote(
    db: DbClient,
    input: QuoteCheckoutDto,
    providers: Array<{ code: string; name: string }>,
    requireServiceAnswers = false,
    buyerId?: string
  ) {
    const offerIds = input.items.map((line) => line.offerId);
    const offers = await db.seller_offers.findMany({
      where: {
        id: { in: offerIds }, status: "active",
        listing: { status: "active", product: { status: "active", type: { not: "bridge" } }, seller: { invited: false, approved: true, suspended_at: null } }
      },
      select: {
        id: true, price: true, currency: true,
        digital: { select: { file_reference: true, file_references: true, file_titles: true, max_downloads: true } },
        physical: { select: { stock: true, weight_grams: true, length_cm: true, width_cm: true, height_cm: true } },
        service: { select: { input_schema: true } },
        listing: {
          select: {
            seller: { select: { id: true, shop_name: true, commission: true, commission_digital: true, commission_physical: true, commission_service: true, commission_bridge: true, permissions: { where: { permission: "physical_products_manage" }, select: { permission: true } }, shipping_profile: { select: { enabled: true, latitude: true, longitude: true } } } },
            product: {
              select: {
                id: true,
                title: true,
                type: true,
                price_currency: true,
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
    if (offers.some((offer) => offer.listing.product.type === "physical") && !await this.shippingProviders.active().isConfigured()) {
      throw new ServiceUnavailableException("Postal shipping is not configured");
    }
    const currencies = new Set(offers.map((offer) => offer.currency.trim()));
    const wrongCurrencyOffers = offers.filter((offer) => offer.currency.trim() !== offer.listing.product.price_currency);
    if (wrongCurrencyOffers.length) {
      throw new PublicHttpException(HttpStatus.CONFLICT, "One or more cart items are unavailable", {
        code: "CART_ITEMS_UNAVAILABLE",
        offerIds: wrongCurrencyOffers.map((offer) => offer.id)
      });
    }
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
    const shippingPolicy = await this.shippingPolicy.effective(db);
    const groups = new Map<string, {
      key: string; seller: { id: string; shopName: string }; productType: ProductType;
      commissionRate: string; items: InternalQuoteLine[]; total: Prisma.Decimal;
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
      if (type === "physical" && (offer.physical?.weight_grams ?? 0) < 10) {
        throw new PublicHttpException(HttpStatus.CONFLICT, `${offer.listing.product.title} has no valid parcel weight`, {
          code: "CART_ITEMS_UNAVAILABLE", offerIds: [offer.id]
        });
      }
      if (type === "physical" && offer.listing.seller.permissions.length === 0) {
        throw new PublicHttpException(HttpStatus.CONFLICT, `${offer.listing.product.title} is not currently available for physical delivery`, {
          code: "CART_ITEMS_UNAVAILABLE",
          offerIds: [offer.id]
        });
      }
      if (type === "physical" && (!offer.listing.seller.shipping_profile?.enabled || offer.listing.seller.shipping_profile.latitude == null || offer.listing.seller.shipping_profile.longitude == null)) {
        throw new PublicHttpException(HttpStatus.CONFLICT, `${offer.listing.product.title} is not currently available for physical delivery`, {
          code: "CART_ITEMS_UNAVAILABLE", offerIds: [offer.id]
        });
      }
      if (type === "digital" && (!offer.digital || !digitalFileReferences(offer.digital).every((url) => this.isHttpsUrl(url)))) {
        throw new PublicHttpException(HttpStatus.CONFLICT, `${offer.listing.product.title} has no valid HTTPS delivery URL`, {
          code: "CART_ITEMS_UNAVAILABLE",
          offerIds: [offer.id]
        });
      }
      if (type !== "service" && requested.serviceNote?.trim()) throw new BadRequestException("Only service products accept a customer note");
      if (type !== "service" && requested.serviceAnswers?.length) throw new BadRequestException("Only service products accept customer answers");
      const serviceInputs = type === "service" ? this.serviceInputDefinitions(offer.service?.input_schema) : [];
      const serviceAnswers = type === "service"
        ? this.validateServiceAnswers(serviceInputs, requested.serviceAnswers ?? [], requireServiceAnswers)
        : [];
      const key = `${offer.listing.seller.id}:${type}`;
      const group = groups.get(key) ?? {
        key, seller: { id: offer.listing.seller.id, shopName: offer.listing.seller.shop_name }, productType: type,
        commissionRate: sellerCommissionRate(offer.listing.seller, type).toString(), items: [], total: new Prisma.Decimal(0)
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
        serviceInputs, serviceAnswers,
        digitalDeliveryUrl: offer.digital?.file_reference ?? null,
        digitalDeliveryUrls: offer.digital ? digitalFileReferences(offer.digital) : [],
        digitalDeliveryTitles: offer.digital ? digitalFileTitles(offer.digital) : [],
        digitalMaxDownloads: offer.digital?.max_downloads ?? null,
        parcel: offer.physical ? { weightGrams: offer.physical.weight_grams, lengthCm: offer.physical.length_cm, widthCm: offer.physical.width_cm, heightCm: offer.physical.height_cm } : null
      });
      group.total = group.total.add(total);
      groups.set(key, group);
    }
    const quotedGroups = [...groups.values()].sort((a, b) => a.key.localeCompare(b.key)).map((group) => {
      const rule = group.productType === "physical" ? this.shippingPolicy.rule(shippingPolicy, group.seller.id) : null;
      if (rule && input.shippingAddress?.province && rule.allowedProvinces.length && !rule.allowedProvinces.some((province) => normalizeShippingPlace(province) === normalizeShippingPlace(input.shippingAddress!.province))) {
        throw new PublicHttpException(HttpStatus.CONFLICT, `Shipping to ${input.shippingAddress.province} is unavailable for ${group.seller.shopName}`, { code: "SHIPPING_DESTINATION_UNAVAILABLE", sellerId: group.seller.id });
      }
      if (rule) {
        const weight = group.items.reduce((sum, item) => sum + (item.parcel?.weightGrams ?? 0) * item.quantity, 0);
        if (rule.maxWeightGrams != null && (weight > rule.maxWeightGrams || group.items.some((item) => !item.parcel?.weightGrams))) throw new BadRequestException(`The parcel exceeds the weight limit for ${group.seller.shopName}`);
        for (const [dimension, limit] of [["lengthCm", rule.maxLengthCm], ["widthCm", rule.maxWidthCm], ["heightCm", rule.maxHeightCm]] as const) {
          if (limit != null && group.items.some((item) => !item.parcel?.[dimension] || item.parcel[dimension] > limit)) throw new BadRequestException(`A parcel dimension exceeds the limit for ${group.seller.shopName}`);
        }
      }
      const free = rule?.freeAboveToman != null && group.total.greaterThanOrEqualTo(rule.freeAboveToman);
      const shippingCost = rule ? new Prisma.Decimal(rule.flatRateToman) : new Prisma.Decimal(0);
      const shippingPayer = rule ? (free && rule.payer === "customer" ? "site" : rule.payer) : null;
      const shippingFee = shippingPayer === "customer" ? shippingCost : new Prisma.Decimal(0);
      const methods = providers.filter((provider) => {
        if (provider.code === "wallet") return true;
        const config = configByCode.get(provider.code);
        if (!config) return false;
        const sellerAllowed = config.seller_rules.length === 0 || config.seller_rules.some((rule) => rule.seller_id === group.seller.id);
        const typeAllowed = config.product_type_rules.length === 0 || config.product_type_rules.some((rule) => rule.product_type === group.productType);
        return sellerAllowed && typeAllowed;
      });
      return { ...group, items: group.items, shippingCost: shippingCost.toString(), shippingFee: shippingFee.toString(), shippingPayer, totalAmount: group.total.add(shippingFee).toString(), discountAmount: "0", paymentMethods: methods };
    });
    if (quotedGroups.some((group) => group.paymentMethods.length === 0)) throw new ServiceUnavailableException("One or more seller groups have no available payment method");
    const commonPaymentMethods = providers.filter((provider) => quotedGroups.every((group) => group.paymentMethods.some((method) => method.code === provider.code)));
    const couponCode = input.couponCode?.normalize("NFKC").trim().toUpperCase() ?? null;
    let couponId: string | null = null;
    let discountAmount = new Prisma.Decimal(0);
    if (couponCode) {
      const sellers = [...new Set(quotedGroups.map((group) => group.seller.id))];
      const matches = await db.coupons.findMany({
        where: { code: couponCode, OR: [{ seller_id: null }, { seller_id: { in: sellers } }] },
        select: { id: true, seller_id: true, discount_type: true, discount_value: true, currency: true, minimum_order_amount: true, maximum_redemptions: true, redeemed_count: true, starts_at: true, expires_at: true, active: true }
      });
      const platformCoupon = matches.find((item) => item.seller_id === null);
      const eligibleCoupons = platformCoupon ? [platformCoupon] : matches;
      if (eligibleCoupons.length !== 1) throw new BadRequestException("Coupon is invalid for this cart");
      const coupon = eligibleCoupons[0]!;
      const now = new Date();
      if (!coupon.active || coupon.starts_at > now || (coupon.expires_at && coupon.expires_at <= now)
        || (coupon.maximum_redemptions !== null && coupon.redeemed_count >= coupon.maximum_redemptions)) {
        throw new BadRequestException("Coupon is no longer available");
      }
      if (coupon.currency.trim() !== "TOMAN") throw new BadRequestException("Coupon currency is not supported");
      const eligibleGroups = quotedGroups.filter((group) => coupon.seller_id === null || group.seller.id === coupon.seller_id);
      const eligibleTotal = eligibleGroups.reduce((sum, group) => sum.add(group.total), new Prisma.Decimal(0));
      if (coupon.minimum_order_amount && eligibleTotal.lt(coupon.minimum_order_amount)) {
        throw new BadRequestException("Cart does not meet the coupon minimum");
      }
      couponId = coupon.id;
      if (coupon.discount_type === "percentage") {
        for (const group of eligibleGroups) {
          const amount = group.total.mul(coupon.discount_value).div(100).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
          group.discountAmount = amount.toString();
          discountAmount = discountAmount.add(amount);
        }
      } else {
        const amount = Prisma.Decimal.min(coupon.discount_value.toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP), eligibleTotal);
        let allocated = new Prisma.Decimal(0);
        eligibleGroups.forEach((group, index) => {
          const share = index === eligibleGroups.length - 1
            ? amount.minus(allocated)
            : amount.mul(group.total).div(eligibleTotal).toDecimalPlaces(0, Prisma.Decimal.ROUND_DOWN);
          group.discountAmount = share.toString();
          allocated = allocated.add(share);
        });
        discountAmount = amount;
      }
      if (discountAmount.lte(0) || eligibleGroups.some((group) => group.total.lte(group.discountAmount))) {
        throw new BadRequestException("Coupon would leave an order group with no payable amount");
      }
      for (const group of eligibleGroups) group.totalAmount = group.total.minus(group.discountAmount).add(group.shippingFee).toString();
    }
    if ((input.clubPoints || input.clubRewardId) && !this.club) throw new ServiceUnavailableException("Club ledger unavailable");
    const clubAllocation = this.club ? await this.club.quoteCheckout(db, buyerId, quotedGroups, input.clubPoints ?? 0, input.clubRewardId) : { points: 0, rewardId: null, discount: new Prisma.Decimal(0), groups: new Map<string, { points: number; discount: Prisma.Decimal }>() };
    const clubGroups = quotedGroups.map((group) => {
      const allocation = clubAllocation.groups.get(group.key);
      const clubDiscountAmount = allocation?.discount.toString() ?? "0";
      return { ...group, clubDiscountAmount, clubPoints: allocation?.points ?? 0,
        totalAmount: new Prisma.Decimal(group.totalAmount).minus(clubDiscountAmount).toString(),
        discountAmount: new Prisma.Decimal(group.discountAmount).add(clubDiscountAmount).toString() };
    });
    const total = clubGroups.reduce((sum, group) => sum.add(group.totalAmount), new Prisma.Decimal(0));
    return { currency: "TOMAN", totalAmount: total.toString(), discountAmount: discountAmount.add(clubAllocation.discount).toString(), clubDiscountAmount: clubAllocation.discount.toString(), clubPoints: clubAllocation.points, clubAllocation, couponCode, couponId, usdToTomanRate: tomanPerUsd?.toString() ?? null, groups: clubGroups, commonPaymentMethods, requiresShippingAddress: clubGroups.some((group) => group.productType === "physical") };
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

  private validateServiceAnswers(
    schema: ServiceInputDefinition[],
    answers: Array<{ key: string; value: string }>,
    requireAnswers: boolean
  ) {
    const supplied = new Map(answers.map((answer) => [answer.key.trim(), answer.value]));
    const definitions = new Map(schema.map((field) => [field.key, field]));
    for (const key of supplied.keys()) {
      if (!definitions.has(key)) throw new BadRequestException(`Unknown service field: ${key}`);
    }
    const validated: Array<{ key: string; value: string }> = [];
    for (const field of schema) {
      const value = supplied.get(field.key) ?? "";
      if (requireAnswers && field.required && value.length === 0) {
        throw new BadRequestException(`${field.label} is required`);
      }
      if (!value) continue;
      const minimumLength = field.minimumLength ?? 0;
      const maximumLength = field.maximumLength ?? 2_000;
      if (value.length < minimumLength || value.length > maximumLength) {
        throw new BadRequestException(`${field.label} has an invalid length`);
      }
      validated.push({ key: field.key, value });
    }
    return validated;
  }

  private encryptServiceAnswers(itemId: string, answers: Array<{ key: string; value: string }>) {
    if (!answers.length) return null;
    if (!this.crypto) throw new ServiceUnavailableException("Service answer encryption is unavailable");
    return this.crypto.encrypt(JSON.stringify(answers), `service-order-item:${itemId}:answers`, "SERVICE_INPUT");
  }

  private serviceInputDefinitions(value: Prisma.JsonValue | null | undefined): ServiceInputDefinition[] {
    if (!Array.isArray(value)) return [];
    return value.flatMap((field) => {
      if (!field || typeof field !== "object" || Array.isArray(field)) return [];
      if (
        typeof field.key !== "string" ||
        typeof field.label !== "string" ||
        !["text", "textarea", "password"].includes(String(field.type)) ||
        typeof field.required !== "boolean"
      ) return [];
      return [{
        key: field.key,
        label: field.label,
        type: field.type as ServiceInputDefinition["type"],
        required: field.required,
        ...(typeof field.placeholder === "string" ? { placeholder: field.placeholder } : {}),
        ...(typeof field.helpText === "string" ? { helpText: field.helpText } : {}),
        ...(typeof field.minimumLength === "number" ? { minimumLength: field.minimumLength } : {}),
        ...(typeof field.maximumLength === "number" ? { maximumLength: field.maximumLength } : {})
      }];
    });
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
      id: checkout.id, status: checkout.status, currency: checkout.currency.trim(), totalAmount: checkout.total_amount.toString(), discountAmount: checkout.discount_amount.toString(), couponCode: checkout.coupon?.code ?? null,
      expiresAt: checkout.expires_at.toISOString(), createdAt: checkout.created_at.toISOString(),
      orders: checkout.orders.map((order) => ({
        id: order.id, status: order.status, seller: { id: order.seller_id, shopName: order.seller.shop_name }, totalAmount: order.total_amount.toString(), discountAmount: order.discount_amount.toString(),
        shippingCost: order.shipping_cost.toString(), shippingFee: order.shipping_fee.toString(), shippingPayer: order.shipping_payer,
        shippingAddress: order.shipping_address ? {
          recipientName: order.shipping_address.recipient_name, phoneNumber: order.shipping_address.phone_number,
          province: order.shipping_address.province, city: order.shipping_address.city, postalCode: order.shipping_address.postal_code.trim(), addressLine: order.shipping_address.address_line
        } : null,
        shipment: order.shipment ? { carrier: order.shipment.carrier, trackingCode: order.shipment.tracking_code, shippedAt: order.shipment.shipped_at.toISOString() } : null,
        items: order.items.map((item) => ({
          id: item.id, offerId: item.offer_id, productType: item.product_type, productTitle: item.product_title,
          quantity: item.quantity, unitPrice: item.unit_price.toString(), totalAmount: item.total_amount.toString(), serviceNote: item.service_note,
          digitalDelivery: mapDigitalDeliveries(order.id, item.id, item.digital_entitlement, item.digital_delivery_titles)[0] ?? null,
          digitalDeliveries: mapDigitalDeliveries(order.id, item.id, item.digital_entitlement, item.digital_delivery_titles)
        }))
      })),
      paymentGroups: checkout.payment_groups.map((group) => ({
        id: group.id, provider: group.provider, status: group.status, amount: group.amount.toString(), walletAmount: group.wallet_amount.toString(), currency: group.currency.trim(),
        orderIds: group.orders.map((order) => order.order_id), expiresAt: group.expires_at.toISOString(), latestAttempt: group.attempts[0] ?? null
      }))
    };
  }
}
