import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { createHash, randomUUID } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service";
import type {
  AddSellerOfferDto,
  AddSellerOffersDto,
  CreateProductDto,
  CreateProductOfferDto,
  ListProductsQueryDto,
  UpdateSellerOfferDto
} from "./dto/product.dto";

const activeOfferWhere = {
  status: "active",
  listing: {
    status: "active",
    seller: { invited: false, approved: true, suspended_at: null }
  }
} as const;

const variantOptionSelect = {
  option_value: {
    select: {
      value: true,
      option: { select: { name: true, position: true } }
    }
  }
} as const;

const sellerListingSelect = Prisma.validator<Prisma.seller_listingsSelect>()({
  id: true,
  status: true,
  created_at: true,
  updated_at: true,
  product: {
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      category: true,
      kind: true,
      type: true,
      status: true,
      created_at: true,
      updated_at: true
    }
  },
  offers: {
    orderBy: [{ created_at: "asc" }, { id: "asc" }],
    select: {
      id: true,
      price: true,
      currency: true,
      seller_sku: true,
      status: true,
      created_at: true,
      updated_at: true,
      variant: {
        select: {
          id: true,
          name: true,
          option_values: { select: variantOptionSelect }
        }
      },
      digital: {
        select: { file_reference: true, max_downloads: true }
      },
      physical: { select: { stock: true, weight_grams: true } },
      service: {
        select: {
          service_type: true,
          estimated_hours: true,
          instructions: true
        }
      }
    }
  }
});

type SellerListingRecord = Prisma.seller_listingsGetPayload<{
  select: typeof sellerListingSelect;
}>;

type VariantPlan = {
  id: string;
  key: string;
  name: string | null;
  signature: string;
  values: Array<{ optionId: string; optionValueId: string }>;
};

type OptionPlan = {
  id: string;
  name: string;
  normalizedName: string;
  position: number;
  values: Array<{
    id: string;
    value: string;
    normalizedValue: string;
    position: number;
  }>;
};

type ProductPlan = {
  productId: string;
  slug: string;
  options: OptionPlan[];
  variants: VariantPlan[];
  offers: Array<{ variantId: string; input: CreateProductOfferDto }>;
};

@Injectable()
export class ProductService {
  constructor(private readonly prisma: PrismaService) {}

  sitemapProjection() {
    return this.prisma.products.findMany({
      where: {
        status: "active",
        variants: { some: { offers: { some: activeOfferWhere } } }
      },
      orderBy: [{ updated_at: "desc" }, { id: "desc" }],
      select: { slug: true, updated_at: true }
    });
  }

  async listPublic(input: ListProductsQueryDto) {
    const products = await this.prisma.products.findMany({
      where: {
        status: "active",
        variants: { some: { offers: { some: activeOfferWhere } } }
      },
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      take: input.limit,
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
      select: {
        id: true,
        title: true,
        slug: true,
        category: true,
        kind: true,
        type: true,
        created_at: true
      }
    });

    if (!products.length) return [];

    const prices = await this.prisma.$queryRaw<
      Array<{ product_id: string; currency: string; price: Prisma.Decimal }>
    >(Prisma.sql`
      SELECT DISTINCT ON (v."product_id", o."currency")
        v."product_id", o."currency", o."price"
      FROM "seller_offers" o
      JOIN "seller_listings" l ON l."id" = o."listing_id"
      JOIN "sellers" s ON s."id" = l."seller_id"
      JOIN "product_variants" v ON v."id" = o."variant_id"
      WHERE v."product_id" IN (${Prisma.join(products.map((product) => product.id))})
        AND o."status" = 'active'::"listing_status"
        AND l."status" = 'active'::"listing_status"
        AND s."invited" = FALSE
        AND s."approved" = TRUE
        AND s."suspended_at" IS NULL
      ORDER BY v."product_id", o."currency", o."price", o."id"
    `);

    const pricesByProduct = new Map<
      string,
      Array<{ currency: string; price: string }>
    >();
    for (const row of prices) {
      const current = pricesByProduct.get(row.product_id) ?? [];
      current.push({ currency: row.currency.trim(), price: row.price.toString() });
      pricesByProduct.set(row.product_id, current);
    }

    return products.map((product) => {
      const startingPrices = pricesByProduct.get(product.id) ?? [];
      return {
        id: product.id,
        title: product.title,
        slug: product.slug,
        category: product.category,
        kind: product.kind,
        type: product.type,
        ...(startingPrices.length === 1
          ? {
              price: startingPrices[0].price,
              currency: startingPrices[0].currency
            }
          : {}),
        startingPrices,
        createdAt: product.created_at.toISOString()
      };
    });
  }

  async getPublic(idOrSlug: string) {
    if (!idOrSlug || idOrSlug.length > 200) {
      throw new NotFoundException("Product was not found");
    }

    const product = await this.prisma.products.findFirst({
      where: {
        status: "active",
        OR: [{ id: idOrSlug }, { slug: idOrSlug }],
        variants: { some: { offers: { some: activeOfferWhere } } }
      },
      select: {
        id: true,
        title: true,
        slug: true,
        description: true,
        category: true,
        kind: true,
        type: true,
        created_at: true,
        updated_at: true,
        options: {
          orderBy: [{ position: "asc" }, { id: "asc" }],
          select: {
            id: true,
            name: true,
            values: {
              orderBy: [{ position: "asc" }, { id: "asc" }],
              select: { id: true, value: true }
            }
          }
        },
        variants: {
          orderBy: [{ created_at: "asc" }, { id: "asc" }],
          select: {
            id: true,
            name: true,
            option_values: { select: variantOptionSelect },
            offers: {
              where: activeOfferWhere,
              orderBy: [
                { currency: "asc" },
                { price: "asc" },
                { id: "asc" }
              ],
              take: 20,
              select: {
                id: true,
                price: true,
                currency: true,
                listing: {
                  select: {
                    seller: { select: { id: true, shop_name: true } }
                  }
                },
                digital: { select: { max_downloads: true } },
                physical: { select: { stock: true, weight_grams: true } },
                service: {
                  select: { service_type: true, estimated_hours: true }
                }
              }
            }
          }
        }
      }
    });

    if (!product) throw new NotFoundException("Product was not found");

    return {
      id: product.id,
      title: product.title,
      slug: product.slug,
      description: product.description,
      category: product.category,
      kind: product.kind,
      type: product.type,
      options: product.options.map((option) => ({
        id: option.id,
        name: option.name,
        values: option.values
      })),
      variants: product.variants.map((variant) => ({
        id: variant.id,
        name: variant.name,
        options: this.mapVariantOptions(variant.option_values),
        offers: variant.offers.map((offer) => ({
          id: offer.id,
          price: offer.price.toString(),
          currency: offer.currency.trim(),
          seller: {
            id: offer.listing.seller.id,
            shopName: offer.listing.seller.shop_name
          },
          ...(offer.digital
            ? { digital: { maxDownloads: offer.digital.max_downloads } }
            : {}),
          ...(offer.physical
            ? {
                physical: {
                  inStock: offer.physical.stock > 0,
                  weightGrams: offer.physical.weight_grams
                }
              }
            : {}),
          ...(offer.service
            ? {
                service: {
                  serviceType: offer.service.service_type,
                  estimatedHours: offer.service.estimated_hours
                }
              }
            : {})
        }))
      })),
      createdAt: product.created_at.toISOString(),
      updatedAt: product.updated_at.toISOString()
    };
  }

  async listSellerListings(
    sellerId: string,
    input: ListProductsQueryDto
  ) {
    const listings = await this.prisma.seller_listings.findMany({
      where: { seller_id: sellerId },
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      take: input.limit + 1,
      orderBy: [{ updated_at: "desc" }, { id: "desc" }],
      select: sellerListingSelect
    });
    const hasMore = listings.length > input.limit;
    const page = hasMore ? listings.slice(0, input.limit) : listings;

    return {
      items: page.map((listing) => this.toSellerListing(listing)),
      nextCursor: hasMore ? page.at(-1)?.id ?? null : null
    };
  }

  async listAdminProducts(input: ListProductsQueryDto) {
    const products = await this.prisma.products.findMany({
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      take: input.limit + 1,
      orderBy: [{ updated_at: "desc" }, { id: "desc" }],
      select: {
        id: true,
        title: true,
        slug: true,
        category: true,
        kind: true,
        type: true,
        status: true,
        created_at: true,
        updated_at: true,
        _count: { select: { listings: true } }
      }
    });
    const hasMore = products.length > input.limit;
    const page = hasMore ? products.slice(0, input.limit) : products;

    return {
      items: page.map((product) => ({
        id: product.id,
        title: product.title,
        slug: product.slug,
        category: product.category,
        kind: product.kind,
        type: product.type,
        status: product.status,
        listingCount: product._count.listings,
        createdAt: product.created_at.toISOString(),
        updatedAt: product.updated_at.toISOString()
      })),
      nextCursor: hasMore ? page.at(-1)?.id ?? null : null
    };
  }

  async createProduct(sellerId: string, input: CreateProductDto) {
    const plan = this.buildProductPlan(input);

    try {
      await this.prisma.$transaction(async (transaction) => {
        await transaction.products.create({
          data: {
            id: plan.productId,
            created_by_seller_id: sellerId,
            title: this.clean(input.title),
            slug: plan.slug,
            description: this.cleanOptional(input.description),
            category: this.cleanOptional(input.category),
            kind: input.kind,
            type: input.type,
            status: input.status ?? "active"
          }
        });

        if (plan.options.length) {
          await transaction.product_options.createMany({
            data: plan.options.map((option) => ({
              id: option.id,
              product_id: plan.productId,
              name: option.name,
              normalized_name: option.normalizedName,
              position: option.position
            }))
          });
          await transaction.product_option_values.createMany({
            data: plan.options.flatMap((option) =>
              option.values.map((value) => ({
                id: value.id,
                option_id: option.id,
                value: value.value,
                normalized_value: value.normalizedValue,
                position: value.position
              }))
            )
          });
        }

        await transaction.product_variants.createMany({
          data: plan.variants.map((variant) => ({
            id: variant.id,
            product_id: plan.productId,
            name: variant.name,
            option_signature: variant.signature
          }))
        });

        const variantValues = plan.variants.flatMap((variant) =>
          variant.values.map((value) => ({
            variant_id: variant.id,
            option_id: value.optionId,
            option_value_id: value.optionValueId
          }))
        );
        if (variantValues.length) {
          await transaction.product_variant_values.createMany({
            data: variantValues
          });
        }

        const listing = await transaction.seller_listings.create({
          data: {
            seller_id: sellerId,
            product_id: plan.productId,
            status: "active"
          },
          select: { id: true }
        });

        for (const offer of plan.offers) {
          await this.createOffer(
            transaction,
            listing.id,
            offer.variantId,
            input.type,
            offer.input
          );
        }
        await this.validateDeferredConstraints(transaction);
      });
    } catch (error) {
      this.rethrowWriteError(error);
    }

    return this.getSellerListingByProduct(sellerId, plan.productId);
  }

  async addSellerOffers(
    sellerId: string,
    productId: string,
    input: AddSellerOffersDto
  ) {
    try {
      await this.prisma.$transaction(async (transaction) => {
        const product = await transaction.products.findFirst({
          where: {
            id: productId,
            OR: [{ status: "active" }, { created_by_seller_id: sellerId }]
          },
          select: {
            id: true,
            type: true,
            variants: { select: { id: true } }
          }
        });
        if (!product) throw new NotFoundException("Product was not found");

        const variantIds = new Set(product.variants.map((variant) => variant.id));
        for (const offer of input.offers) {
          if (!variantIds.has(offer.variantId)) {
            throw new BadRequestException(
              `Variant ${offer.variantId} does not belong to this product`
            );
          }
          this.assertFulfillment(product.type, offer);
        }

        const existingListing = await transaction.seller_listings.findUnique({
          where: {
            seller_id_product_id: { seller_id: sellerId, product_id: product.id }
          },
          select: { id: true, status: true }
        });
        const listing = existingListing
          ? await transaction.seller_listings.update({
              where: { id: existingListing.id },
              data:
                input.listingStatus === undefined
                  ? {}
                  : { status: input.listingStatus },
              select: { id: true }
            })
          : await transaction.seller_listings.create({
              data: {
                seller_id: sellerId,
                product_id: product.id,
                status: input.listingStatus ?? "active"
              },
              select: { id: true }
            });

        for (const offer of input.offers) {
          await this.createOffer(
            transaction,
            listing.id,
            offer.variantId,
            product.type,
            offer
          );
        }
        await this.validateDeferredConstraints(transaction);
      });
    } catch (error) {
      this.rethrowWriteError(error);
    }

    return this.getSellerListingByProduct(sellerId, productId);
  }

  async updateSellerOffer(
    sellerId: string,
    offerId: string,
    input: UpdateSellerOfferDto
  ) {
    if (!Object.values(input).some((value) => value !== undefined)) {
      throw new BadRequestException("At least one offer field is required");
    }

    try {
      await this.prisma.$transaction(async (transaction) => {
        const offer = await transaction.seller_offers.findFirst({
          where: { id: offerId, listing: { seller_id: sellerId } },
          select: {
            id: true,
            listing_id: true,
            listing: { select: { product: { select: { type: true } } } }
          }
        });
        if (!offer) throw new NotFoundException("Seller offer was not found");

        const detail = this.detailFromInput(input);
        if (detail) this.assertFulfillment(offer.listing.product.type, input);

        await transaction.seller_offers.update({
          where: { id: offer.id },
          data: {
            ...(input.price === undefined
              ? {}
              : { price: new Prisma.Decimal(input.price) }),
            ...(input.currency === undefined
              ? {}
              : { currency: input.currency.toUpperCase() }),
            ...(input.sellerSku === undefined
              ? {}
              : { seller_sku: this.clean(input.sellerSku) }),
            ...(input.status === undefined ? {} : { status: input.status })
          }
        });

        if (input.digital) {
          await transaction.seller_offer_digital.update({
            where: { offer_id: offer.id },
            data: {
              file_reference: input.digital.fileReference,
              max_downloads: input.digital.maxDownloads
            }
          });
        }
        if (input.physical) {
          await transaction.seller_offer_physical.update({
            where: { offer_id: offer.id },
            data: {
              stock: input.physical.stock,
              weight_grams: input.physical.weightGrams
            }
          });
        }
        if (input.service) {
          await transaction.seller_offer_service.update({
            where: { offer_id: offer.id },
            data: {
              service_type: this.clean(input.service.serviceType),
              estimated_hours: input.service.estimatedHours,
              instructions: this.cleanOptional(input.service.instructions)
            }
          });
        }
        await this.validateDeferredConstraints(transaction);
      });
    } catch (error) {
      this.rethrowWriteError(error);
    }

    return this.getSellerOffer(sellerId, offerId);
  }

  private buildProductPlan(input: CreateProductDto): ProductPlan {
    const productId = randomUUID();
    const title = this.clean(input.title);
    const slug = input.slug ? this.slugify(input.slug) : this.slugify(title);
    if (!slug) throw new BadRequestException("A usable product slug is required");

    if (input.kind === "simple") {
      if (input.variants?.length) {
        throw new BadRequestException("Simple products cannot define variants");
      }
      if (input.offers.length !== 1 || input.offers[0].variantKey) {
        throw new BadRequestException(
          "A simple product requires exactly one offer without a variant key"
        );
      }
      this.assertFulfillment(input.type, input.offers[0]);
      const variantId = randomUUID();
      return {
        productId,
        slug,
        options: [],
        variants: [
          {
            id: variantId,
            key: "__simple__",
            name: null,
            signature: this.signature("simple"),
            values: []
          }
        ],
        offers: [{ variantId, input: input.offers[0] }]
      };
    }

    if (!input.variants?.length) {
      throw new BadRequestException("Variable products require variants");
    }

    const variantKeys = new Set<string>();
    const signatures = new Set<string>();
    const firstOptionNames = input.variants[0].options.map((option) =>
      this.normalized(option.name)
    );
    if (new Set(firstOptionNames).size !== firstOptionNames.length) {
      throw new BadRequestException("Variant option names must be unique");
    }

    const optionPlans: OptionPlan[] = firstOptionNames.map(
      (normalizedName, position) => ({
        id: randomUUID(),
        name: this.clean(input.variants![0].options[position].name),
        normalizedName,
        position,
        values: []
      })
    );
    const optionByName = new Map(
      optionPlans.map((option) => [option.normalizedName, option])
    );

    const variants = input.variants.map((variant) => {
      const key = this.normalized(variant.key);
      if (variantKeys.has(key)) {
        throw new BadRequestException("Variant keys must be unique");
      }
      variantKeys.add(key);

      const normalizedNames = variant.options.map((option) =>
        this.normalized(option.name)
      );
      if (
        new Set(normalizedNames).size !== firstOptionNames.length ||
        normalizedNames.some((name) => !optionByName.has(name))
      ) {
        throw new BadRequestException(
          "Every variant must provide one value for the same option names"
        );
      }

      const canonical: Array<[string, string]> = [];
      const values = variant.options.map((item) => {
        const normalizedName = this.normalized(item.name);
        const normalizedValue = this.normalized(item.value);
        const option = optionByName.get(normalizedName)!;
        let value = option.values.find(
          (candidate) => candidate.normalizedValue === normalizedValue
        );
        if (!value) {
          value = {
            id: randomUUID(),
            value: this.clean(item.value),
            normalizedValue,
            position: option.values.length
          };
          option.values.push(value);
        }
        canonical.push([normalizedName, normalizedValue]);
        return { optionId: option.id, optionValueId: value.id };
      });

      canonical.sort(([left], [right]) => left.localeCompare(right));
      const signature = this.signature(JSON.stringify(canonical));
      if (signatures.has(signature)) {
        throw new BadRequestException("Variant option combinations must be unique");
      }
      signatures.add(signature);

      return {
        id: randomUUID(),
        key,
        name: this.cleanOptional(variant.name),
        signature,
        values
      };
    });

    const variantByKey = new Map(
      variants.map((variant) => [variant.key, variant.id])
    );
    const offeredVariants = new Set<string>();
    const offers = input.offers.map((offer) => {
      if (!offer.variantKey) {
        throw new BadRequestException(
          "Every variable-product offer requires a variant key"
        );
      }
      const key = this.normalized(offer.variantKey);
      const variantId = variantByKey.get(key);
      if (!variantId) {
        throw new BadRequestException(
          `Offer variant key ${offer.variantKey} was not defined`
        );
      }
      if (offeredVariants.has(variantId)) {
        throw new BadRequestException(
          "A seller can create only one offer for each variant"
        );
      }
      offeredVariants.add(variantId);
      this.assertFulfillment(input.type, offer);
      return { variantId, input: offer };
    });

    return { productId, slug, options: optionPlans, variants, offers };
  }

  private async createOffer(
    transaction: Prisma.TransactionClient,
    listingId: string,
    variantId: string,
    productType: "digital" | "physical" | "service",
    input: CreateProductOfferDto | AddSellerOfferDto
  ) {
    this.assertFulfillment(productType, input);
    const offer = await transaction.seller_offers.create({
      data: {
        listing_id: listingId,
        variant_id: variantId,
        price: new Prisma.Decimal(input.price),
        currency: input.currency.toUpperCase(),
        seller_sku: this.cleanOptional(input.sellerSku),
        status: input.status ?? "active"
      },
      select: { id: true }
    });

    if (input.digital) {
      await transaction.seller_offer_digital.create({
        data: {
          offer_id: offer.id,
          file_reference: input.digital.fileReference,
          max_downloads: input.digital.maxDownloads
        }
      });
    } else if (input.physical) {
      await transaction.seller_offer_physical.create({
        data: {
          offer_id: offer.id,
          stock: input.physical.stock,
          weight_grams: input.physical.weightGrams
        }
      });
    } else if (input.service) {
      await transaction.seller_offer_service.create({
        data: {
          offer_id: offer.id,
          service_type: this.clean(input.service.serviceType),
          estimated_hours: input.service.estimatedHours,
          instructions: this.cleanOptional(input.service.instructions)
        }
      });
    }
  }

  private assertFulfillment(
    productType: "digital" | "physical" | "service",
    input: {
      digital?: unknown;
      physical?: unknown;
      service?: unknown;
    }
  ) {
    const details = [
      input.digital ? "digital" : null,
      input.physical ? "physical" : null,
      input.service ? "service" : null
    ].filter(Boolean);
    if (details.length !== 1 || details[0] !== productType) {
      throw new BadRequestException(
        `Exactly one ${productType} fulfillment object is required`
      );
    }
  }

  private detailFromInput(input: UpdateSellerOfferDto) {
    return input.digital ?? input.physical ?? input.service;
  }

  private async getSellerListingByProduct(
    sellerId: string,
    productId: string
  ) {
    const listing = await this.prisma.seller_listings.findFirst({
      where: { seller_id: sellerId, product_id: productId },
      select: sellerListingSelect
    });
    if (!listing) throw new NotFoundException("Seller listing was not found");
    return this.toSellerListing(listing);
  }

  private async getSellerOffer(sellerId: string, offerId: string) {
    const listing = await this.prisma.seller_listings.findFirst({
      where: { seller_id: sellerId, offers: { some: { id: offerId } } },
      select: sellerListingSelect
    });
    if (!listing) throw new NotFoundException("Seller offer was not found");
    const mapped = this.toSellerListing(listing);
    const offer = mapped.offers.find((item) => item.id === offerId);
    if (!offer) throw new NotFoundException("Seller offer was not found");
    return offer;
  }

  private toSellerListing(listing: SellerListingRecord) {
    return {
      id: listing.id,
      status: listing.status,
      product: {
        id: listing.product.id,
        title: listing.product.title,
        slug: listing.product.slug,
        description: listing.product.description,
        category: listing.product.category,
        kind: listing.product.kind,
        type: listing.product.type,
        status: listing.product.status,
        createdAt: listing.product.created_at.toISOString(),
        updatedAt: listing.product.updated_at.toISOString()
      },
      offers: listing.offers.map((offer) => ({
        id: offer.id,
        variant: {
          id: offer.variant.id,
          name: offer.variant.name,
          options: this.mapVariantOptions(offer.variant.option_values)
        },
        price: offer.price.toString(),
        currency: offer.currency.trim(),
        sellerSku: offer.seller_sku,
        status: offer.status,
        ...(offer.digital
          ? {
              digital: {
                fileReference: offer.digital.file_reference,
                maxDownloads: offer.digital.max_downloads
              }
            }
          : {}),
        ...(offer.physical
          ? {
              physical: {
                stock: offer.physical.stock,
                weightGrams: offer.physical.weight_grams
              }
            }
          : {}),
        ...(offer.service
          ? {
              service: {
                serviceType: offer.service.service_type,
                estimatedHours: offer.service.estimated_hours,
                instructions: offer.service.instructions
              }
            }
          : {}),
        createdAt: offer.created_at.toISOString(),
        updatedAt: offer.updated_at.toISOString()
      })),
      createdAt: listing.created_at.toISOString(),
      updatedAt: listing.updated_at.toISOString()
    };
  }

  private mapVariantOptions(
    values: Array<{
      option_value: {
        value: string;
        option: { name: string; position: number };
      };
    }>
  ) {
    return values
      .map((item) => ({
        name: item.option_value.option.name,
        value: item.option_value.value,
        position: item.option_value.option.position
      }))
      .sort((left, right) => left.position - right.position)
      .map(({ name, value }) => ({ name, value }));
  }

  private rethrowWriteError(error: unknown): never {
    if (
      error instanceof BadRequestException ||
      error instanceof NotFoundException ||
      error instanceof ConflictException
    ) {
      throw error;
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      throw new ConflictException(
        "The slug, seller SKU, variant combination, or seller offer already exists"
      );
    }
    throw error;
  }

  private async validateDeferredConstraints(
    transaction: Prisma.TransactionClient
  ) {
    // Prisma 5's interactive transaction API does not reliably surface an
    // exception raised by a deferred constraint during COMMIT on PostgreSQL.
    // Force evaluation before the callback returns so the request cannot report
    // success for a transaction the database rolls back.
    await transaction.$executeRawUnsafe(
      'SET CONSTRAINTS "seller_offers_fulfillment_check", ' +
        '"seller_offer_digital_fulfillment_check", ' +
        '"seller_offer_physical_fulfillment_check", ' +
        '"seller_offer_service_fulfillment_check" IMMEDIATE'
    );
  }

  private signature(value: string) {
    return createHash("sha256").update(value).digest("hex");
  }

  private slugify(value: string) {
    return value
      .normalize("NFKC")
      .toLocaleLowerCase("en-US")
      .trim()
      .replace(/[^\p{L}\p{N}]+/gu, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 200);
  }

  private normalized(value: string) {
    return this.clean(value).normalize("NFKC").toLocaleLowerCase("en-US");
  }

  private clean(value: string) {
    return value.normalize("NFKC").trim().replace(/\s+/g, " ");
  }

  private cleanOptional(value: string | undefined) {
    if (value === undefined) return null;
    const cleaned = this.clean(value);
    return cleaned || null;
  }
}
