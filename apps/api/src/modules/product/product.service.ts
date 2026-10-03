import { categoryLabel, managedCategorySelect, productCategorySelect, productCategoryUpdate, resolveProductCategory, type ProductCategoryRecord } from "./product-category";
import type { CreateProductCategoryDto, DeleteProductCategoryDto, ProductCategoriesQueryDto, UpdateProductCategoryDto } from "./dto/product-category.dto";
import { legacySitemapRows } from "../seo/legacy-sitemap";
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { Prisma } from "../../prisma/client";
import { ConfigService } from "@nestjs/config";
import { createHash, randomUUID } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service";
import type {
  AddSellerOfferDto,
  AddSellerOffersDto,
  BulkUndoProductChangesDto,
  CreateProductDto,
  CreateProductOfferDto,
  DigitalFulfillmentDto,
  ListProductsQueryDto,
  ManageProductsQueryDto,
  SellerProductsQueryDto,
  PreviewBulkUndoProductChangesDto,
  ServiceInputDefinitionDto,
  UpdateAdminProductDto,
  UpdateProductDto,
  UpdateSellerOfferDto
} from "./dto/product.dto";

import { activeOfferWhere, publicProductWhere, publishedTranslationSelect } from "./product-visibility";
import { normalizeProductDescription } from "./product-description";
import { isAllowedUnsignedFileUrl } from "../order/upload-download-link";

const variantOptionSelect = {
  option_value: {
    select: {
      value: true,
      option: { select: { name: true, position: true } }
    }
  }
} as const;

const productMediaSelect = {
  id: true,
  variants: {
    orderBy: { variant: "asc" as const },
    select: { variant: true, width: true, height: true }
  }
} satisfies Prisma.product_media_assetsSelect;

const sellerListingSelect = {
  id: true,
  seller_id: true,
  status: true,
  created_at: true,
  updated_at: true,
  product: {
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      category_record: { select: productCategorySelect },
      kind: true,
      type: true,
      price_currency: true,
      status: true,
      created_at: true,
      updated_at: true,
      created_by_seller_id: true,
      media: { select: productMediaSelect },
      bridge_binding: {
        select: {
          mode: true,
          minimum_quantity: true,
          maximum_quantity: true,
          field_labels: true,
          accepted_schema_hash: true,
          schema_review_needed: true,
          grant: { select: { id: true, status: true, service: { select: { id: true, name: true, field_schema: true, schema_hash: true, available: true } } } }
        }
      }
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
        select: { file_reference: true, file_references: true, file_titles: true, max_downloads: true }
      },
      physical: { select: { stock: true, weight_grams: true, length_cm: true, width_cm: true, height_cm: true } },
      service: {
        select: {
          service_type: true,
          estimated_hours: true,
          instructions: true,
          input_schema: true
        }
      }
    }
  }
} satisfies Prisma.seller_listingsSelect;

const adminProductSelect = {
  id: true,
  price_currency: true,
  title: true,
  slug: true,
  description: true,
  tags: true,
  category_record: { select: productCategorySelect },
  kind: true,
  type: true,
  status: true,
  created_at: true,
  updated_at: true,
  media: { select: productMediaSelect },
  created_by: { select: { id: true, shop_name: true } },
  _count: { select: { listings: true } }
} satisfies Prisma.productsSelect;

const adminProductDetailSelect = {
  ...adminProductSelect,
  created_by: { select: { id: true, shop_name: true } },
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
      option_values: { select: variantOptionSelect }
    }
  }
} satisfies Prisma.productsSelect;

const adminListingSelect = {
  id: true,
  status: true,
  created_at: true,
  updated_at: true,
  seller: { select: { id: true, shop_name: true } },
  offers: sellerListingSelect.offers
} satisfies Prisma.seller_listingsSelect;

const productSnapshotSelect = {
  title: true,
  slug: true,
  description: true,
  tags: true,
  category_record: { select: productCategorySelect },
  type: true,
  status: true
} satisfies Prisma.productsSelect;

const productChangeSelect = {
  id: true,
  action: true,
  changed_fields: true,
  before_snapshot: true,
  after_snapshot: true,
  restored_from_event_id: true,
  bulk_operation_id: true,
  created_at: true,
  actor: { select: { id: true, full_name: true, role: true } },
  product: {
    select: {
      id: true,
      title: true,
      slug: true,
      type: true,
      created_by: { select: { id: true, shop_name: true } }
    }
  }
} satisfies Prisma.product_change_eventsSelect;

type ProductSnapshot = {
  title: string;
  type?: "digital" | "physical" | "service" | "bridge";
  slug?: string;
  description: string | null;
  tags?: string[];
  category: string | null;
  categoryId?: string | null;
  status: "draft" | "pending_review" | "active" | "archived" | "trashed";
};

type ProductSnapshotRecord = Omit<ProductSnapshot, "category"> & { category_record: ProductCategoryRecord | null };

function searchVariants(term: string) {
  const canonical = term
    .replace(/[يى]/gu, "ی")
    .replace(/ك/gu, "ک")
    .replace(/[٠-٩۰-۹]/gu, (digit) => {
      const code = digit.charCodeAt(0);
      return String(code >= 0x06f0 ? code - 0x06f0 : code - 0x0660);
    });
  return [...new Set([
    term,
    canonical,
    canonical.replace(/ی/gu, "ي").replace(/ک/gu, "ك"),
    canonical.replace(/[0-9]/gu, (digit) => String.fromCharCode(0x06f0 + Number(digit))),
    canonical.replace(/[0-9]/gu, (digit) => String.fromCharCode(0x0660 + Number(digit)))
  ])];
}

const productSnapshotFields = ["title", "slug", "description", "tags", "category", "status", "type"] as const;

type AdminProductRecord = Prisma.productsGetPayload<{
  select: typeof adminProductSelect;
}>;

type AdminProductDetailRecord = Prisma.productsGetPayload<{
  select: typeof adminProductDetailSelect;
}>;

type AdminListingRecord = Prisma.seller_listingsGetPayload<{
  select: typeof adminListingSelect;
}>;

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
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  async listCategories(input: ProductCategoriesQueryDto) {
    const rows = await this.prisma.product_categories.findMany({
      where: input.search?.trim() ? { name: { startsWith: input.search.trim(), mode: "insensitive" } } : {},
      orderBy: [{ name: "asc" }, { id: "asc" }],
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      take: input.limit + 1,
      select: productCategorySelect
    });
    const items = rows.slice(0,input.limit);
    return { items, nextCursor: rows.length > input.limit ? items.at(-1)!.id : null };
  }

  async listManagedCategories(input: ProductCategoriesQueryDto) {
    const rows = await this.prisma.product_categories.findMany({
      where: input.search?.trim() ? { name: { contains: input.search.trim(), mode: "insensitive" } } : {},
      orderBy: [{ name: "asc" }, { id: "asc" }],
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      take: input.limit + 1,
      select: managedCategorySelect
    });
    const items = rows.slice(0, input.limit).map((row) => this.mapManagedCategory(row));
    return { items, nextCursor: rows.length > input.limit ? items.at(-1)!.id : null };
  }

  private mapManagedCategory(row: Prisma.product_categoriesGetPayload<{ select: typeof managedCategorySelect }>) {
    return {
      id: row.id, name: row.name, slug: row.slug, description: row.description,
      metaTitle: row.meta_title, metaDescription: row.meta_description,
      parentId: row.parent_id, parentName: row.parent?.name ?? null,
      imageUrl: row.image_updated_at ? `/products/categories/${row.id}/image?v=${row.image_updated_at.getTime()}` : null,
      productCount: row._count.products, childCount: row._count.children,
      translations: row.translations, createdAt: row.created_at, updatedAt: row.updated_at
    };
  }

  async createCategory(actorId: string, input: CreateProductCategoryDto) {
    const name = input.name?.trim().replace(/\s+/gu, " ");
    if (!name) throw new BadRequestException("Category name is required");
    const slug = input.slug?.trim().toLowerCase() ?? name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-|-$/g, "");
    if (!slug || slug.length > 160) throw new BadRequestException("A valid category slug is required");
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(420124, 1)`;
        if (input.parentId && !await tx.product_categories.findUnique({ where: { id: input.parentId }, select: { id: true } })) {
          throw new NotFoundException("Parent category was not found");
        }
        const [inserted] = await tx.$queryRaw<Array<{ id: string }>>`INSERT INTO product_categories
          (name, normalized_name, slug, description, meta_title, meta_description, parent_id)
          VALUES (${name}, normalize_product_category(${name}), ${slug}, ${input.description?.trim() || null},
            ${input.metaTitle?.trim() || null}, ${input.metaDescription?.trim() || null}, ${input.parentId ?? null}::uuid)
          RETURNING id`;
        for (const translation of input.translations ?? []) {
          await tx.product_category_translations.create({ data: { category_id: inserted!.id, locale: translation.locale, name: translation.name.trim() } });
        }
        const after = await tx.product_categories.findUniqueOrThrow({ where: { id: inserted!.id }, select: managedCategorySelect });
        await tx.product_category_events.create({ data: { category_id: inserted!.id, actor_user_id: actorId, before_data: { created: true }, after_data: { id: after.id, name: after.name, slug: after.slug, parentId: after.parent_id } } });
        return this.mapManagedCategory(after);
      });
    } catch (error) {
      this.handleCategoryWriteError(error);
    }
  }

  async updateCategory(id: string, actorId: string, input: UpdateProductCategoryDto) {
    const name = input.name?.trim().replace(/\s+/gu," ");
    if (name === "" || input.translations?.some((item) => !item.name.trim())) {
      throw new BadRequestException("A nonempty category name or translation is required");
    }
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(420124, 1)`;
        await tx.$queryRaw`SELECT id FROM product_categories WHERE id=${id}::uuid FOR UPDATE`;
        const before = await tx.product_categories.findUnique({ where: { id }, select: managedCategorySelect });
        if (!before) throw new NotFoundException("Product category was not found");
        if (input.parentId !== undefined) {
          if (input.parentId === id) throw new BadRequestException("A category cannot be its own parent");
          if (input.parentId) {
            const ancestors = await tx.$queryRaw<Array<{ id: string }>>`WITH RECURSIVE ancestors AS (
              SELECT id, parent_id FROM product_categories WHERE id=${input.parentId}::uuid
              UNION ALL SELECT p.id, p.parent_id FROM product_categories p JOIN ancestors a ON p.id=a.parent_id
            ) SELECT id FROM ancestors`;
            if (!ancestors.length) throw new NotFoundException("Parent category was not found");
            if (ancestors.some((ancestor) => ancestor.id === id)) throw new BadRequestException("A category cannot be moved below its descendant");
          }
        }
        if (name !== undefined) await tx.$executeRaw`
          UPDATE product_categories SET name=${name},normalized_name=normalize_product_category(${name}),updated_at=now() WHERE id=${id}::uuid
        `;
        await tx.product_categories.update({ where: { id }, data: {
          ...(input.slug !== undefined ? { slug: input.slug.trim().toLowerCase() } : {}),
          ...(input.description !== undefined ? { description: input.description?.trim() || null } : {}),
          ...(input.metaTitle !== undefined ? { meta_title: input.metaTitle?.trim() || null } : {}),
          ...(input.metaDescription !== undefined ? { meta_description: input.metaDescription?.trim() || null } : {}),
          ...(input.parentId !== undefined ? { parent_id: input.parentId } : {})
        } });
        for (const translation of input.translations ?? []) {
          await tx.product_category_translations.upsert({
            where: { category_id_locale: { category_id: id, locale: translation.locale } },
            create: { category_id: id, locale: translation.locale, name: translation.name.trim() },
            update: { name: translation.name.trim() }
          });
        }
        const after = await tx.product_categories.findUniqueOrThrow({ where: { id }, select: managedCategorySelect });
        await tx.product_category_events.create({ data: { category_id: id, actor_user_id: actorId, before_data: this.mapManagedCategory(before), after_data: this.mapManagedCategory(after) } });
        return this.mapManagedCategory(after);
      });
    } catch (error) {
      this.handleCategoryWriteError(error);
    }
  }

  async deleteCategory(id: string, actorId: string, input: DeleteProductCategoryDto) {
    if (input.productAction === "move" && (!input.replacementCategoryId || input.replacementCategoryId === id)) {
      throw new BadRequestException("A different replacement category is required");
    }
    if (input.productAction === "uncategorize" && input.replacementCategoryId !== undefined) {
      throw new BadRequestException("A replacement category is only valid for move");
    }
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(420124, 1)`;
        await tx.$queryRaw`SELECT id FROM product_categories WHERE id=${id}::uuid FOR UPDATE`;
        const category = await tx.product_categories.findUnique({ where: { id }, select: managedCategorySelect });
        if (!category) throw new NotFoundException("Product category was not found");
        if (category._count.children) throw new ConflictException("Move child categories before deleting this category");
        if (input.replacementCategoryId && !await tx.product_categories.findUnique({ where: { id: input.replacementCategoryId }, select: { id: true } })) {
          throw new NotFoundException("Replacement category was not found");
        }
        const movedProducts = await tx.products.updateMany({ where: { category_id: id }, data: { category_id: input.replacementCategoryId ?? null } });
        await tx.product_category_events.create({ data: {
          category_id: id, actor_user_id: actorId, before_data: this.mapManagedCategory(category),
          after_data: { deleted: true, productAction: input.productAction, replacementCategoryId: input.replacementCategoryId ?? null, movedProducts: movedProducts.count }
        } });
        await tx.product_categories.delete({ where: { id } });
        return { deletedId: id, movedProducts: movedProducts.count };
      });
    } catch (error) {
      this.handleCategoryWriteError(error);
    }
  }

  async setCategoryImage(id: string, actorId: string, data: Buffer | null) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.product_categories.findUnique({ where: { id }, select: managedCategorySelect });
      if (!before) throw new NotFoundException("Product category was not found");
      await tx.product_categories.update({ where: { id }, data: { image_data: data ? new Uint8Array(data) : null, image_updated_at: data ? new Date() : null }, select: { id: true } });
      const after = await tx.product_categories.findUniqueOrThrow({ where: { id }, select: managedCategorySelect });
      await tx.product_category_events.create({ data: { category_id: id, actor_user_id: actorId, before_data: { imageUrl: this.mapManagedCategory(before).imageUrl }, after_data: { imageUrl: this.mapManagedCategory(after).imageUrl } } });
      return this.mapManagedCategory(after);
    });
  }

  async getCategoryImage(id: string) {
    const category = await this.prisma.product_categories.findUnique({ where: { id }, select: { image_data: true, image_updated_at: true } });
    if (!category?.image_data || !category.image_updated_at) throw new NotFoundException("Category image was not found");
    return { buffer: Buffer.from(category.image_data), etag: `"${id}-${category.image_updated_at.getTime()}"` };
  }

  private handleCategoryWriteError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002" || (error.code === "P2010" && error.meta?.code === "23505")) throw new ConflictException("Category name or slug already exists");
      if (error.code === "P2003" || (error.code === "P2010" && error.meta?.code === "23503")) throw new ConflictException("The category is still referenced");
    }
    throw error;
  }

  sitemapProjection() {
    return legacySitemapRows((cursor) => this.prisma.products.findMany({
      where: publicProductWhere(this.bridgeEnabled()),
      orderBy: [{ updated_at: "desc" }, { id: "desc" }],
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      take: 1000,
      select: { id: true, slug: true, updated_at: true }
    }), (row) => row.id);
  }

  async listPublic(input: ListProductsQueryDto) {
    return (await this.listPublicPage(input)).items;
  }

  async listPublicPage(input: ListProductsQueryDto) {
    if (input.type === "bridge" && !this.bridgeEnabled()) {
      if (input.cursor) throw new NotFoundException("Page was not found");
      return { items: [], nextCursor: null };
    }
    const terms = input.search?.trim().split(/\s+/u).filter(Boolean).slice(0, 8) ?? [];
    const rows = await this.prisma.products.findMany({
      where: {
        ...publicProductWhere(this.bridgeEnabled()),
        ...(input.categoryId ? { category_id: input.categoryId } : {}),
        ...(input.type ? { type: input.type } : this.bridgeEnabled() ? {} : { type: { not: "bridge" as const } }),
        ...(terms.length ? { AND: terms.map((term) => ({
          OR: searchVariants(term).flatMap((variant) => [
            { title: { contains: variant, mode: "insensitive" as const } },
            { slug: { contains: variant, mode: "insensitive" as const } },
            { category_record: { OR: [
              { name: { contains: variant, mode: "insensitive" as const } },
              { translations: { some: { locale: input.locale ?? "fa", name: { contains: variant, mode: "insensitive" as const } } } }
            ] } },
            { translations: { some: { locale: input.locale ?? "fa", published_at: { not: null }, OR: [{ published_title: { contains: variant, mode: "insensitive" as const } }, { published_category: { contains: variant, mode: "insensitive" as const } }] } } }
          ])
        })) } : {})
      },
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      take: input.limit + 1,
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
      select: {
        id: true,
        title: true,
        translations: { where: { published_at: { not: null } }, select: publishedTranslationSelect },
        slug: true,
        category_record: { select: productCategorySelect },
        kind: true,
        type: true,
        price_currency: true,
        created_at: true,
        media: { select: productMediaSelect }
      }
    });

    const products = rows.slice(0, input.limit);
    if (!products.length && input.cursor) throw new NotFoundException("Page was not found");
    if (!products.length) return { items: [], nextCursor: null };

    const prices = await this.prisma.$queryRaw<
      Array<{ product_id: string; currency: string; price: Prisma.Decimal }>
    >(Prisma.sql`
      SELECT DISTINCT ON (v."product_id", o."currency")
        v."product_id", o."currency", o."price"
      FROM "seller_offers" o
      JOIN "seller_listings" l ON l."id" = o."listing_id"
      JOIN "products" p ON p."id" = l."product_id"
      JOIN "sellers" s ON s."id" = l."seller_id"
      JOIN "product_variants" v ON v."id" = o."variant_id"
      WHERE v."product_id" IN (${Prisma.join(products.map((product) => Prisma.sql`${product.id}::uuid`))})
        AND o."status" = 'active'::"listing_status"
        AND BTRIM(o."currency") = p."price_currency"
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

    const items = products.map((product) => {
      const startingPrices = pricesByProduct.get(product.id) ?? [];
      const translated = product.translations.find((item) => item.locale === input.locale);
      return {
        id: product.id,
        availableLocales: ["fa", ...product.translations.map((item) => item.locale)],
        title: translated?.published_title ?? product.title,
        slug: product.slug,
        category: categoryLabel(product.category_record, input.locale, translated?.published_category),
        categoryId: product.category_record?.id ?? null,
        kind: product.kind,
        type: product.type,
        currency: product.price_currency,
        image: this.mapProductImage(product.media),
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
    return { items, nextCursor: rows.length > input.limit ? products.at(-1)!.id : null };
  }

  async getPublic(idOrSlug: string, locale: "fa" | "en" | "ar" = "fa") {
    if (!idOrSlug || idOrSlug.length > 200) {
      throw new NotFoundException("Product was not found");
    }

    const where: Prisma.productsWhereInput = {
      ...publicProductWhere(this.bridgeEnabled()),
      AND: [{ OR: [...(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu.test(idOrSlug) ? [{ id: idOrSlug }] : []), { slug: idOrSlug }, { slug_routes: { some: { slug: idOrSlug } } }] }]
    };
    const priceSelection = await this.prisma.products.findFirst({ where, select: { price_currency: true } });
    if (!priceSelection) throw new NotFoundException("Product was not found");
    const product = await this.prisma.products.findFirst({
      where,
      select: {
        id: true,
        title: true,
        translations: { where: { published_at: { not: null } }, select: publishedTranslationSelect },
        slug: true,
        description: true,
        category_record: { select: productCategorySelect },
        kind: true,
        type: true,
        price_currency: true,
        created_at: true,
        updated_at: true,
        media: { select: productMediaSelect },
        bridge_binding: {
          select: {
            minimum_quantity: true,
            maximum_quantity: true,
            field_labels: true,
            grant: { select: { service: { select: { field_schema: true } } } }
          }
        },
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
              where: { ...activeOfferWhere, currency: priceSelection.price_currency },
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
                digital: { select: { max_downloads: true, file_references: true } },
                physical: { select: { stock: true, weight_grams: true, length_cm: true, width_cm: true, height_cm: true } },
                service: {
                  select: { service_type: true, estimated_hours: true, input_schema: true }
                }
              }
            }
          }
        }
      }
    });

    if (!product) throw new NotFoundException("Product was not found");

    const translated = product.translations.find((item) => item.locale === locale);
    return {
      id: product.id,
      availableLocales: ["fa", ...product.translations.map((item) => item.locale)],
      contentLocale: translated ? locale : "fa",
      title: translated?.published_title ?? product.title,
      slug: product.slug,
      description: translated?.published_description ?? product.description,
      category: categoryLabel(product.category_record, locale, translated?.published_category),
      categoryId: product.category_record?.id ?? null,
      kind: product.kind,
      type: product.type,
      currency: product.price_currency,
      image: this.mapProductImage(product.media),
      ...(product.bridge_binding
        ? {
            bridge: {
              fields: this.applyFieldLabels(
                product.bridge_binding.grant.service.field_schema,
                product.bridge_binding.field_labels
              ),
              minimumQuantity: product.bridge_binding.minimum_quantity,
              maximumQuantity: product.bridge_binding.maximum_quantity
            }
          }
        : {}),
      options: product.options.map((option) => ({
        id: option.id,
        name: option.name,
        values: option.values
      })),
      variants: product.variants.map((variant) => ({
        id: variant.id,
        name: variant.name,
        options: this.mapVariantOptions(variant.option_values),
        offers: variant.offers.filter((offer) => offer.currency.trim() === product.price_currency).map((offer) => ({
          id: offer.id,
          price: offer.price.toString(),
          currency: offer.currency.trim(),
          seller: {
            id: offer.listing.seller.id,
            shopName: offer.listing.seller.shop_name
          },
          ...(offer.digital
            ? { digital: { maxDownloads: offer.digital.max_downloads, fileCount: Math.max(1, offer.digital.file_references.length) } }
            : {}),
          ...(offer.physical
            ? {
                physical: {
                  inStock: offer.physical.stock > 0,
                  weightGrams: offer.physical.weight_grams,
                  lengthCm: offer.physical.length_cm, widthCm: offer.physical.width_cm, heightCm: offer.physical.height_cm
                }
              }
            : {}),
          ...(offer.service
            ? {
                service: {
                  serviceType: offer.service.service_type,
                  estimatedHours: offer.service.estimated_hours,
                  inputs: this.serviceInputDefinitions(offer.service.input_schema)
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
    input: SellerProductsQueryDto
  ) {
    const productWhere = this.manageProductWhere(input);
    const listings = await this.prisma.seller_listings.findMany({
      where: {
        seller_id: sellerId,
        ...(input.listingStatus ? { status: input.listingStatus } : {}),
        ...(Object.keys(productWhere).length ? { product: { is: productWhere } } : {})
      },
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      take: input.limit + 1,
      orderBy: input.sort?.startsWith("title_")
        ? [{ product: { title: input.sort.endsWith("asc") ? "asc" : "desc" } }, { id: input.sort?.endsWith("asc") ? "asc" : "desc" }]
        : [{ [input.sort?.startsWith("created_") ? "created_at" : "updated_at"]: input.sort?.endsWith("asc") ? "asc" : "desc" }, { id: input.sort?.endsWith("asc") ? "asc" : "desc" }],
      select: sellerListingSelect
    });
    const hasMore = listings.length > input.limit;
    const page = hasMore ? listings.slice(0, input.limit) : listings;

    return {
      items: page.map((listing) => this.toSellerListing(listing)),
      nextCursor: hasMore ? page.at(-1)?.id ?? null : null
    };
  }

  async listAdminProducts(input: ManageProductsQueryDto) {
    const where = this.manageProductWhere(input);
    const countWhere = this.manageProductWhere({ ...input, status: undefined });
    const [products, counts] = await Promise.all([
      this.prisma.products.findMany({
        where,
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        take: input.limit + 1,
        orderBy: input.sort?.startsWith("title_")
          ? [{ title: input.sort.endsWith("asc") ? "asc" : "desc" }, { id: input.sort?.endsWith("asc") ? "asc" : "desc" }]
          : [{ [input.sort?.startsWith("created_") ? "created_at" : "updated_at"]: input.sort?.endsWith("asc") ? "asc" : "desc" }, { id: input.sort?.endsWith("asc") ? "asc" : "desc" }],
        select: adminProductSelect
      }),
      this.prisma.products.groupBy({
        by: ["status"],
        where: countWhere,
        _count: { _all: true }
      })
    ]);
    const hasMore = products.length > input.limit;
    const page = hasMore ? products.slice(0, input.limit) : products;
    const statusCounts = { draft: 0, pending_review: 0, active: 0, archived: 0, trashed: 0 };
    for (const count of counts) statusCounts[count.status] = count._count._all;

    return {
      items: page.map((product) => this.toAdminProduct(product)),
      nextCursor: hasMore ? page.at(-1)?.id ?? null : null,
      statusCounts
    };
  }

  private manageProductWhere(input: ManageProductsQueryDto): Prisma.productsWhereInput {
    const search = input.search?.trim();
    const category = input.category?.trim();
    const seller = input.seller?.trim();
    const dateFrom = input.dateFrom ? this.adminFilterInstant(input.dateFrom) : undefined;
    const dateTo = input.dateTo ? this.adminFilterInstant(input.dateTo) : undefined;
    if (dateFrom && dateTo && dateFrom >= dateTo) throw new BadRequestException("Date range is reversed");
    if (input.stock && input.type && input.type !== "physical") throw new BadRequestException("Stock filter requires physical products");
    const dateField = input.dateField === "created" ? "created_at" : "updated_at";
    const stockedOffer: Prisma.seller_listingsWhereInput = {
      status: "active",
      offers: { some: { status: "active", physical: { is: { stock: { gt: 0 } } } } }
    };
    const sellerListing: Prisma.seller_listingsWhereInput = seller
      ? { seller: { shop_name: { contains: seller, mode: "insensitive" } } }
      : {};
    return {
      ...(input.type ? { type: input.type } : {}),
      ...(input.kind ? { kind: input.kind } : {}),
      ...(input.status ? { status: input.status } : {}),
      ...(input.categoryId ? { category_id: input.categoryId } : {}),
      ...(category ? { category_record: { name: { contains: category, mode: "insensitive" as const } } } : {}),
      ...(seller || input.stock ? { AND: [
        ...(seller && input.stock !== "in_stock" ? [{ listings: { some: sellerListing } }] : []),
        ...(input.stock === "in_stock" ? [{ listings: { some: { ...sellerListing, ...stockedOffer } } }] : []),
        ...(input.stock === "out_of_stock" ? [{ listings: { none: { ...sellerListing, ...stockedOffer } } }] : [])
      ] } : {}),
      ...(dateFrom || dateTo ? { [dateField]: {
        ...(dateFrom ? { gte: dateFrom } : {}),
        ...(dateTo ? { lt: dateTo } : {})
      } } : {}),
      ...(input.stock ? { type: "physical" as const } : {}),
      ...(search ? { OR: [
        { title: { contains: search, mode: "insensitive" as const } },
        { slug: { contains: search, mode: "insensitive" as const } },
        { category_record: { name: { contains: search, mode: "insensitive" as const } } }
      ] } : {})
    };
  }

  private adminFilterInstant(value: string) {
    const instant = new Date(value);
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value) ||
      Number.isNaN(instant.getTime()) || instant.toISOString() !== value) {
      throw new BadRequestException("Invalid product filter date");
    }
    return instant;
  }

  async listProductChanges(input: ListProductsQueryDto, productId?: string) {
    if (productId) {
      const exists = await this.prisma.products.count({ where: { id: productId } });
      if (!exists) throw new NotFoundException("Product was not found");
    }
    const events = await this.prisma.product_change_events.findMany({
      where: productId ? { product_id: productId } : undefined,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      take: input.limit + 1,
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
      select: productChangeSelect
    });
    const hasMore = events.length > input.limit;
    const page = hasMore ? events.slice(0, input.limit) : events;
    return {
      items: page.map((event) => this.toProductChange(event)),
      nextCursor: hasMore ? page.at(-1)?.id ?? null : null
    };
  }

  async getAdminProduct(productId: string, input: ListProductsQueryDto) {
    const [product, listings] = await Promise.all([
      this.prisma.products.findUnique({
        where: { id: productId },
        select: adminProductDetailSelect
      }),
      this.prisma.seller_listings.findMany({
        where: { product_id: productId },
        ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
        take: input.limit + 1,
        orderBy: { id: "asc" },
        select: adminListingSelect
      })
    ]);
    if (!product) throw new NotFoundException("Product was not found");
    const hasMore = listings.length > input.limit;
    const page = hasMore ? listings.slice(0, input.limit) : listings;
    return this.toAdminProductDetail(
      product,
      page,
      hasMore ? page.at(-1)?.id ?? null : null
    );
  }

  async previewBulkUndo(input: PreviewBulkUndoProductChangesDto) {
    this.assertBulkUndoSelector(input);
    const events = await this.prisma.product_change_events.findMany({
      where: this.bulkUndoWhere(input),
      take: input.count + 1,
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
      select: { id: true, product_id: true }
    });
    const selected = events.slice(0, input.count);
    return {
      changeIds: selected.map((event) => event.id),
      changeCount: selected.length,
      affectedProductCount: new Set(selected.map((event) => event.product_id)).size,
      hasMore: events.length > input.count
    };
  }

  async bulkUndo(input: BulkUndoProductChangesDto, actorUserId: string) {
    this.assertBulkUndoSelector(input);
    return this.prisma.$transaction(async (tx) => {
      const replay = await tx.product_change_events.findMany({
        where: { bulk_operation_id: input.operationId },
        select: { actor_user_id: true, product_id: true, restored_from_event_id: true }
      });
      if (replay.length) {
        const replayedChangeIds = replay
          .map((event) => event.restored_from_event_id)
          .filter((id): id is string => Boolean(id))
          .sort();
        const requestedChangeIds = [...input.changeIds].sort();
        if (
          replay.some((event) => event.actor_user_id !== actorUserId) ||
          replayedChangeIds.length !== requestedChangeIds.length ||
          replayedChangeIds.some((id, index) => id !== requestedChangeIds[index])
        ) {
          throw new ConflictException("Bulk undo operation ID is already in use");
        }
        return {
          operationId: input.operationId,
          undoneCount: replay.length,
          affectedProductCount: new Set(replay.map((event) => event.product_id)).size,
          replayed: true
        };
      }

      const events = await tx.product_change_events.findMany({
        where: {
          AND: [this.bulkUndoWhere(input), { id: { in: input.changeIds } }]
        },
        orderBy: [{ created_at: "desc" }, { id: "desc" }],
        select: {
          id: true,
          product_id: true,
          changed_fields: true,
          before_snapshot: true,
          after_snapshot: true
        }
      });
      if (
        events.length !== input.changeIds.length ||
        events.some((event) => !input.changeIds.includes(event.id))
      ) {
        throw new ConflictException("Bulk undo preview is stale; preview the changes again");
      }

      const productIds = [...new Set(events.map((event) => event.product_id))].sort();
      await tx.$queryRaw(Prisma.sql`
        SELECT "id"
        FROM "products"
        WHERE "id" IN (${Prisma.join(productIds.map((id) => Prisma.sql`${id}::uuid`))})
        ORDER BY "id"
        FOR UPDATE
      `);
      const products = await tx.products.findMany({
        where: { id: { in: productIds } },
        select: {
          id: true,
          ...productSnapshotSelect,
          bridge_binding: { select: { schema_review_needed: true } }
        }
      });
      if (products.length !== productIds.length) {
        throw new ConflictException("One or more products no longer exist");
      }
      const currentByProduct = new Map(products.map((product) => [product.id, product]));

      for (const event of events) {
        const current = currentByProduct.get(event.product_id)!;
        if (!event.before_snapshot) {
          throw new ConflictException("A selected change has no earlier product version");
        }
        const previous = this.readProductSnapshot(event.before_snapshot);
        const expectedCurrent = this.readProductSnapshot(event.after_snapshot);
        const data = await this.productFieldsFromSnapshot(tx, previous, event.changed_fields);
        if (!this.changedProductFieldsMatch(current, expectedCurrent, event.changed_fields)) {
          throw new ConflictException(
            "A newer excluded change modified the same product field; adjust the filters and preview again"
          );
        }
        if (data.status === "active" && current.bridge_binding?.schema_review_needed) {
          throw new ConflictException("A Bridge product requires schema review before it can be restored as active");
        }
        const updated = await tx.products.update({
          where: { id: event.product_id },
          data,
          select: productSnapshotSelect
        });
        await this.recordProductChange(
          tx,
          event.product_id,
          actorUserId,
          "restore",
          current,
          updated,
          event.id,
          input.operationId
        );
        currentByProduct.set(event.product_id, {
          ...updated,
          id: event.product_id,
          bridge_binding: current.bridge_binding
        });
      }

      return {
        operationId: input.operationId,
        undoneCount: events.length,
        affectedProductCount: productIds.length,
        replayed: false
      };
    });
  }

  async updateAdminProduct(
    productId: string,
    actorUserId: string,
    input: UpdateAdminProductDto
  ) {
    this.assertProductUpdate(input);

    try {
      const product = await this.prisma.$transaction(async (tx) => {
        const current = await tx.products.findUnique({
          where: { id: productId },
          select: {
            ...productSnapshotSelect,
            bridge_binding: { select: { schema_review_needed: true } }
          }
        });
        if (!current) throw new NotFoundException("Product was not found");
        if (input.status === "active" && current.bridge_binding?.schema_review_needed) {
          throw new ConflictException("The Bridge product requires schema review before it can become active");
        }
        const typeChanged = await this.changeProductType(tx, productId, current.type, current.status, input);
        const updated = await tx.products.update({
          where: { id: productId },
          data: {
            ...await this.productUpdateData(tx,input),
            ...(input.slug === undefined ? {} : { slug: this.slugify(input.slug) }),
            ...(typeChanged ? { status: "draft" } : {})
          },
          select: adminProductSelect
        });
        if (typeChanged) await this.validateDeferredConstraints(tx);
        await this.recordProductChange(tx, productId, actorUserId, "update", current, updated);
        return updated;
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
      return this.toAdminProduct(product);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw new NotFoundException("Product was not found");
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
        throw new ConflictException("The product changed during editing; reload and try again");
      }
      this.rethrowWriteError(error);
    }
  }

  async transferProductSeller(productId: string, actorUserId: string, sellerId: string) {
    try {
      await this.prisma.$transaction(async (tx) => {
      const product = await tx.products.findUnique({
        where: { id: productId },
        select: {
          ...productSnapshotSelect,
          type: true,
          created_by: { select: { id: true, shop_name: true } },
          bridge_binding: { select: { grant_id: true } },
          listings: { select: { id: true, seller_id: true, offers: { select: { _count: { select: { order_items: true, inventory_reservations: true } } } } } }
        }
      });
      if (!product) throw new NotFoundException("Product was not found");
      if (product.created_by.id === sellerId) throw new BadRequestException("This seller already owns the product");
      if (product.status === "trashed") throw new ConflictException("Restore the product before transferring its seller");
      const destination = await tx.sellers.findFirst({
        where: { id: sellerId, approved: true, invited: false, suspended_at: null, merged_into_seller_id: null },
        select: { id: true, shop_name: true, permissions: { select: { permission: true } } }
      });
      if (!destination) throw new BadRequestException("Select an active, approved seller");
      const requiredPermission = product.type === "physical" ? "physical_products_manage" : "products_manage";
      if (!destination.permissions.some(({ permission }) => permission === requiredPermission)) {
        throw new BadRequestException("The destination seller cannot manage this product type");
      }
      if (product.bridge_binding) throw new ConflictException("Bridge products cannot be reassigned while bound to a seller service");
      if (product.listings.some((listing) => listing.seller_id === sellerId)) {
        throw new ConflictException("The destination seller already has a listing for this product");
      }
      const sourceListing = product.listings.find((listing) => listing.seller_id === product.created_by.id);
      if (sourceListing?.offers.some((offer) => offer._count.order_items || offer._count.inventory_reservations)) {
        throw new ConflictException("Products with sales or inventory reservations cannot transfer their seller listing");
      }
      if (sourceListing) {
        await tx.seller_listings.update({ where: { id: sourceListing.id }, data: { seller_id: sellerId } });
      } else {
        await tx.seller_listings.create({ data: { seller_id: sellerId, product_id: productId, status: "draft" } });
      }
      await tx.products.update({ where: { id: productId }, data: { created_by_seller_id: sellerId } });
      const snapshot = this.productSnapshot(product);
      await tx.product_change_events.create({ data: {
        product_id: productId,
        actor_user_id: actorUserId,
        action: "update",
        changed_fields: ["seller"],
        before_snapshot: { ...snapshot, seller: { id: product.created_by.id, shopName: product.created_by.shop_name } } as Prisma.InputJsonValue,
        after_snapshot: { ...snapshot, seller: { id: destination.id, shopName: destination.shop_name } } as Prisma.InputJsonValue
      } });
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
        throw new ConflictException("The product changed during transfer; reload and try again");
      }
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
        throw new ConflictException("The destination seller already has a listing for this product");
      }
      throw error;
    }
    return this.getAdminProduct(productId, { limit: 20 });
  }

  async updateAdminListing(
    listingId: string,
    status: "draft" | "active" | "archived"
  ) {
    try {
      const listing = await this.prisma.seller_listings.update({
        where: { id: listingId },
        data: { status },
        select: { id: true, status: true, updated_at: true }
      });
      return {
        id: listing.id,
        status: listing.status,
        updatedAt: listing.updated_at.toISOString()
      };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2025"
      ) {
        throw new NotFoundException("Seller listing was not found");
      }
      throw error;
    }
  }

  async updateAdminOffer(offerId: string, input: UpdateSellerOfferDto) {
    if (!Object.values(input).some((value) => value !== undefined)) {
      throw new BadRequestException("At least one offer field is required");
    }

    try {
      await this.prisma.$transaction(async (transaction) => {
        const offer = await transaction.seller_offers.findUnique({
          where: { id: offerId },
          select: {
            id: true,
            price: true,
            currency: true,
            digital: { select: { file_reference: true, file_references: true, file_titles: true } },
            listing: { select: { product: { select: { type: true, price_currency: true } } } }
          }
        });
        if (!offer) throw new NotFoundException("Seller offer was not found");
        if (input.digital) this.assertImmutableDownloads(offer.digital, input.digital);
        if (input.currency !== undefined && input.currency !== offer.listing.product.price_currency) {
          throw new BadRequestException("Offer currency must match the product currency");
        }
        if (input.price !== undefined || input.currency !== undefined) {
          this.assertOfferMoney(input.price === undefined ? offer.price : new Prisma.Decimal(input.price), input.currency ?? offer.currency.trim());
        }

        const detail = this.detailFromInput(input);
        if (detail) this.assertFulfillment(offer.listing.product.type, input);
        await transaction.seller_offers.update({
          where: { id: offer.id },
          data: {
            ...(input.price === undefined ? {} : { price: new Prisma.Decimal(input.price) }),
            ...(input.currency === undefined ? {} : { currency: input.currency.toUpperCase() }),
            ...(input.sellerSku === undefined
              ? {}
              : { seller_sku: this.cleanOptional(input.sellerSku ?? undefined) }),
            ...(input.status === undefined ? {} : { status: input.status })
          }
        });
        if (input.digital) {
          await transaction.seller_offer_digital.update({
            where: { offer_id: offer.id },
            data: {
              max_downloads: input.digital.maxDownloads
            }
          });
        }
        if (input.physical) {
          await transaction.seller_offer_physical.update({
            where: { offer_id: offer.id },
            data: {
              stock: input.physical.stock,
              weight_grams: input.physical.weightGrams,
              length_cm: input.physical.lengthCm, width_cm: input.physical.widthCm, height_cm: input.physical.heightCm
            }
          });
        }
        if (input.service) {
          await transaction.seller_offer_service.update({
            where: { offer_id: offer.id },
            data: {
              service_type: this.clean(input.service.serviceType),
              estimated_hours: input.service.estimatedHours,
              instructions: this.cleanOptional(input.service.instructions),
              ...(input.service.inputs === undefined
                ? {}
                : { input_schema: this.serviceInputSchema(input.service.inputs) })
            }
          });
        }
        await this.validateDeferredConstraints(transaction);
      });
    } catch (error) {
      this.rethrowWriteError(error);
    }

    const listing = await this.prisma.seller_listings.findFirst({
      where: { offers: { some: { id: offerId } } },
      select: sellerListingSelect
    });
    if (!listing) throw new NotFoundException("Seller offer was not found");
    const mapped = this.toSellerListing(listing);
    const offer = mapped.offers.find((item) => item.id === offerId);
    if (!offer) throw new NotFoundException("Seller offer was not found");
    return offer;
  }

  async restoreProductChange(
    productId: string,
    changeId: string,
    actorUserId: string,
    side: "before" | "after" = "after"
  ) {
    const product = await this.prisma.$transaction(async (tx) => {
      const [event, current] = await Promise.all([
        tx.product_change_events.findFirst({
          where: { id: changeId, product_id: productId },
          select: { id: true, changed_fields: true, before_snapshot: true, after_snapshot: true }
        }),
        tx.products.findUnique({
          where: { id: productId },
          select: {
            ...productSnapshotSelect,
            bridge_binding: { select: { schema_review_needed: true } }
          }
        })
      ]);
      if (!event || !current) throw new NotFoundException("Product change was not found");
      if (event.changed_fields.includes("seller")) throw new ConflictException("Seller transfers cannot be restored as catalog edits");
      if (event.changed_fields.includes("type")) throw new ConflictException("A product type conversion cannot be restored without its original offer fulfillment details");
      const savedSnapshot = side === "before" ? event.before_snapshot : event.after_snapshot;
      if (!savedSnapshot) {
        throw new ConflictException("This change has no earlier product version");
      }
      const target = this.readProductSnapshot(savedSnapshot);
      if (target.status === "active" && current.bridge_binding?.schema_review_needed) {
        throw new ConflictException("The Bridge product requires schema review before it can be restored as active");
      }
      const updated = await tx.products.update({
        where: { id: productId },
        data: await this.productFieldsFromSnapshot(tx,target,productSnapshotFields.filter((field) =>
          field !== "type" && (field !== "slug" || target.slug) && (field !== "tags" || target.tags !== undefined)
        )),
        select: adminProductSelect
      });
      await this.recordProductChange(
        tx,
        productId,
        actorUserId,
        "restore",
        current,
        updated,
        event.id
      );
      return updated;
    });
    return this.toAdminProduct(product);
  }

  async createProduct(sellerId: string, actorUserId: string, input: CreateProductDto) {
    if (input.status === "trashed") throw new ForbiddenException("Only an administrator can move products to trash");
    if (input.type === "bridge" && !this.bridgeEnabled()) throw new ConflictException("Bridge is not enabled");
    if (input.type !== "bridge" && input.bridge) {
      throw new BadRequestException("Only Bridge products may define a Bridge binding");
    }
    const plan = this.buildProductPlan(input);
    const priceCurrency = input.offers[0]?.currency;
    if (!priceCurrency || input.offers.some((offer) => offer.currency !== priceCurrency)) {
      throw new BadRequestException("Every offer on a product must use the same currency");
    }
    const seller = await this.prisma.sellers.findUnique({
      where: { id: sellerId },
      select: { permissions: { select: { permission: true } } }
    });
    if (!seller) throw new NotFoundException("Seller was not found");
    if (input.type === "physical" && !seller.permissions.some((item) => item.permission === "physical_products_manage")) {
      throw new ForbiddenException("Physical-product access has not been granted to this seller");
    }
    const mayPublish = seller.permissions.some((item) => item.permission === "products_publish");
    const requestedStatus = input.status ?? "active";
    const productStatus = requestedStatus === "active" && !mayPublish ? "pending_review" : requestedStatus;
    const bridgeGrant = input.type === "bridge" ? await this.validateBridgeInput(sellerId, input) : null;

    try {
      await this.prisma.$transaction(async (transaction) => {
        const createdProduct = await transaction.products.create({
          data: {
            id: plan.productId,
            created_by_seller_id: sellerId,
            price_currency: priceCurrency,
            title: this.clean(input.title),
            slug: plan.slug,
            description: normalizeProductDescription(input.description),
            category_id: await resolveProductCategory(transaction,input),
            kind: input.kind,
            type: input.type,
            status: productStatus
          },
          select: productSnapshotSelect
        });
        await this.recordProductChange(
          transaction,
          plan.productId,
          actorUserId,
          "create",
          null,
          createdProduct
        );

        if (bridgeGrant && input.bridge) {
          await transaction.bridge_product_bindings.create({
            data: {
              product_id: plan.productId,
              grant_id: bridgeGrant.id,
              mode: input.bridge.mode,
              minimum_quantity: input.bridge.minimumQuantity,
              maximum_quantity: input.bridge.maximumQuantity,
              field_labels: input.bridge.fieldLabels as unknown as Prisma.InputJsonValue,
              accepted_schema_hash: bridgeGrant.service.schema_hash
            }
          });
        }

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

  async updateProduct(
    sellerId: string,
    productId: string,
    actorUserId: string,
    input: UpdateProductDto
  ) {
    this.assertProductUpdate(input);

    const seller = await this.prisma.sellers.findUnique({
      where: { id: sellerId },
      select: { permissions: { select: { permission: true } } }
    });
    if (!seller) throw new NotFoundException("Seller was not found");

    const mayPublish = seller.permissions.some((item) => item.permission === "products_publish");
    try {
      await this.prisma.$transaction(async (tx) => {
        const product = await tx.products.findFirst({
          where: { id: productId, created_by_seller_id: sellerId },
          select: { id: true, ...productSnapshotSelect }
        });
        if (!product) throw new NotFoundException("Seller product was not found");
        if (product.status === "trashed") throw new ForbiddenException("Trashed products can only be restored by an administrator");
        if (input.status === "trashed") throw new ForbiddenException("Only an administrator can move products to trash");
        const typeChanged = await this.changeProductType(tx, product.id, product.type, product.status, input);
        const requestedStatus = input.status;
        const nextStatus = typeChanged ? "draft" : requestedStatus === undefined
          ? product.status === "active" && !mayPublish ? "pending_review" : undefined
          : requestedStatus === "active" && !mayPublish ? "pending_review" : requestedStatus;
        const updated = await tx.products.update({
          where: { id: product.id },
          data: {
            ...await this.productUpdateData(tx,input),
            ...(input.slug === undefined ? {} : { slug: this.slugify(input.slug) }),
            ...(nextStatus === undefined ? {} : { status: nextStatus })
          },
          select: productSnapshotSelect
        });
        if (typeChanged) await this.validateDeferredConstraints(tx);
        await this.recordProductChange(tx, product.id, actorUserId, "update", product, updated);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2034") {
        throw new ConflictException("The product changed during editing; reload and try again");
      }
      this.rethrowWriteError(error);
    }

    return this.getSellerListingByProduct(sellerId, productId);
  }

  async reviewProduct(
    productId: string,
    reviewerId: string,
    status: "active" | "draft",
    reason?: string
  ) {
    await this.prisma.$transaction(async (tx) => {
      const current = await tx.products.findUnique({
        where: { id: productId },
        select: { id: true, ...productSnapshotSelect, bridge_binding: { select: { schema_review_needed: true } } }
      });
      if (!current) throw new NotFoundException("Product was not found");
      if (current.status !== "pending_review") {
        throw new ConflictException("Only pending products can be reviewed");
      }
      if (status === "active" && current.bridge_binding?.schema_review_needed) {
        throw new ConflictException("The seller must accept the current provider schema first");
      }
      const updated = await tx.products.update({
        where: { id: current.id },
        data: { status },
        select: productSnapshotSelect
      });
      await tx.product_review_events.create({
        data: {
          product_id: current.id,
          reviewer_id: reviewerId,
          from_status: current.status,
          to_status: status,
          reason: this.cleanOptional(reason)
        }
      });
      await this.recordProductChange(tx, current.id, reviewerId, "review", current, updated);
    });
    return { id: productId, status, reason: this.cleanOptional(reason) };
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
            price_currency: true,
            created_by_seller_id: true,
            bridge_binding: {
              select: {
                schema_review_needed: true,
                grant: { select: { status: true, seller_id: true, service: { select: { available: true, connection: { select: { status: true } } } } } }
              }
            },
            variants: { select: { id: true } }
          }
        });
        if (!product) throw new NotFoundException("Product was not found");
        if (product.type === "physical") {
          const grant = await transaction.seller_permissions.findUnique({
            where: { seller_id_permission: { seller_id: sellerId, permission: "physical_products_manage" } },
            select: { seller_id: true }
          });
          if (!grant) throw new ForbiddenException("Physical-product access has not been granted to this seller");
        }
        if (product.type === "bridge") {
          const binding = product.bridge_binding;
          if (
            product.created_by_seller_id !== sellerId || !binding ||
            binding.grant.seller_id !== sellerId || binding.grant.status !== "active" ||
            !binding.grant.service.available || binding.grant.service.connection.status !== "active" ||
            binding.schema_review_needed
          ) {
            throw new ForbiddenException("This Bridge product cannot accept seller offers");
          }
        }

        const variantIds = new Set(product.variants.map((variant) => variant.id));
        for (const offer of input.offers) {
          if (offer.currency !== product.price_currency) {
            throw new BadRequestException("Offer currency must match the product currency");
          }
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
            price: true,
            currency: true,
            listing_id: true,
            digital: { select: { file_reference: true, file_references: true, file_titles: true } },
            listing: { select: { product: { select: { type: true, price_currency: true } } } }
          }
        });
        if (!offer) throw new NotFoundException("Seller offer was not found");
        if (input.digital) this.assertImmutableDownloads(offer.digital, input.digital);
        if (input.currency !== undefined && input.currency !== offer.listing.product.price_currency) {
          throw new BadRequestException("Offer currency must match the product currency");
        }
        if (input.price !== undefined || input.currency !== undefined) {
          this.assertOfferMoney(input.price === undefined ? offer.price : new Prisma.Decimal(input.price), input.currency ?? offer.currency.trim());
        }
        if (offer.listing.product.type === "physical") {
          const grant = await transaction.seller_permissions.findUnique({
            where: { seller_id_permission: { seller_id: sellerId, permission: "physical_products_manage" } },
            select: { seller_id: true }
          });
          if (!grant) throw new ForbiddenException("Physical-product access has not been granted to this seller");
        }

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
              : { seller_sku: this.cleanOptional(input.sellerSku ?? undefined) }),
            ...(input.status === undefined ? {} : { status: input.status })
          }
        });

        if (input.digital) {
          await transaction.seller_offer_digital.update({
            where: { offer_id: offer.id },
            data: {
              max_downloads: input.digital.maxDownloads
            }
          });
        }
        if (input.physical) {
          await transaction.seller_offer_physical.update({
            where: { offer_id: offer.id },
            data: {
              stock: input.physical.stock,
              weight_grams: input.physical.weightGrams,
              length_cm: input.physical.lengthCm, width_cm: input.physical.widthCm, height_cm: input.physical.heightCm
            }
          });
        }
        if (input.service) {
          await transaction.seller_offer_service.update({
            where: { offer_id: offer.id },
            data: {
              service_type: this.clean(input.service.serviceType),
              estimated_hours: input.service.estimatedHours,
              instructions: this.cleanOptional(input.service.instructions),
              ...(input.service.inputs === undefined
                ? {}
                : { input_schema: this.serviceInputSchema(input.service.inputs) })
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
    productType: "digital" | "physical" | "service" | "bridge",
    input: CreateProductOfferDto | AddSellerOfferDto
  ) {
    this.assertFulfillment(productType, input);
    if (input.digital) {
      const hosts = this.config.get<string>("UPLOAD_DOWNLOAD_HOSTS") ?? "";
      const urls = input.digital.fileReferences ?? [input.digital.fileReference!];
      if (hosts && !urls.every((url) => isAllowedUnsignedFileUrl(url, hosts))) {
        throw new BadRequestException("Download links must be unsigned HTTPS file URLs on a configured upload host");
      }
    }
    this.assertOfferMoney(new Prisma.Decimal(input.price), input.currency);
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
          file_reference: (input.digital.fileReferences ?? [input.digital.fileReference!])[0]!,
          file_references: input.digital.fileReferences ?? [input.digital.fileReference!],
          file_titles: this.downloadTitles(input.digital),
          max_downloads: input.digital.maxDownloads
        }
      });
    } else if (input.physical) {
      await transaction.seller_offer_physical.create({
        data: {
          offer_id: offer.id,
          stock: input.physical.stock,
          weight_grams: input.physical.weightGrams,
          length_cm: input.physical.lengthCm ?? null, width_cm: input.physical.widthCm ?? null, height_cm: input.physical.heightCm ?? null
        }
      });
    } else if (input.service) {
      await transaction.seller_offer_service.create({
        data: {
          offer_id: offer.id,
          service_type: this.clean(input.service.serviceType),
          estimated_hours: input.service.estimatedHours,
          instructions: this.cleanOptional(input.service.instructions),
          input_schema: this.serviceInputSchema(input.service.inputs)
        }
      });
    } else if (productType === "bridge") {
      await transaction.seller_offer_bridge.create({ data: { offer_id: offer.id } });
    }
  }

  private assertOfferMoney(price: Prisma.Decimal, currency: string) {
    if (currency.toUpperCase() === "TOMAN" && !price.isInteger()) {
      throw new BadRequestException("Toman offers must use integer prices");
    }
  }

  private assertFulfillment(
    productType: "digital" | "physical" | "service" | "bridge",
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
    if (productType === "bridge") {
      if (details.length !== 0) {
        throw new BadRequestException("Bridge offers cannot override provider fulfillment data");
      }
      return;
    }
    if (details.length !== 1 || details[0] !== productType) {
      throw new BadRequestException(
        `Exactly one ${productType} fulfillment object is required`
      );
    }
    if (productType === "digital" && input.digital) this.downloadTitles(input.digital as DigitalFulfillmentDto);
  }

  private downloadTitles(input: DigitalFulfillmentDto): string[] {
    const urls = input.fileReferences ?? [input.fileReference!];
    if (input.fileTitles !== undefined && input.fileTitles.length !== urls.length) {
      throw new BadRequestException("Each download URL must have one title");
    }
    return input.fileTitles?.map((title) => title.trim()) ?? urls.map(() => "");
  }

  private assertImmutableDownloads(current: { file_reference: string; file_references: string[]; file_titles: string[] } | null, input: DigitalFulfillmentDto) {
    if (!current) throw new BadRequestException("This offer has no download links");
    const urls = current.file_references.length ? current.file_references : [current.file_reference];
    const submitted = input.fileReferences ?? [input.fileReference!];
    if (JSON.stringify(urls) !== JSON.stringify(submitted) ||
      (input.fileTitles !== undefined && JSON.stringify(current.file_titles) !== JSON.stringify(input.fileTitles.map((title) => title.trim())))) {
      throw new BadRequestException("Download links cannot be changed after product creation");
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
        category: categoryLabel(listing.product.category_record),
        categoryId: listing.product.category_record?.id ?? null,
        kind: listing.product.kind,
        type: listing.product.type,
        currency: listing.product.price_currency,
        status: listing.product.status,
        image: this.mapProductImage(listing.product.media),
        canEdit: listing.product.created_by_seller_id === listing.seller_id,
        createdAt: listing.product.created_at.toISOString(),
        updatedAt: listing.product.updated_at.toISOString(),
        ...(listing.product.bridge_binding
          ? {
              bridge: {
                grantId: listing.product.bridge_binding.grant.id,
                serviceId: listing.product.bridge_binding.grant.service.id,
                serviceName: listing.product.bridge_binding.grant.service.name,
                grantStatus: listing.product.bridge_binding.grant.status,
                mode: listing.product.bridge_binding.mode,
                minimumQuantity: listing.product.bridge_binding.minimum_quantity,
                maximumQuantity: listing.product.bridge_binding.maximum_quantity,
                schemaReviewNeeded: listing.product.bridge_binding.schema_review_needed,
                acceptedSchemaHash: listing.product.bridge_binding.accepted_schema_hash,
                currentSchemaHash: listing.product.bridge_binding.grant.service.schema_hash,
                fieldLabels: listing.product.bridge_binding.field_labels
              }
            }
          : {})
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
                fileReferences: offer.digital.file_references.length ? offer.digital.file_references : [offer.digital.file_reference],
                fileTitles: offer.digital.file_titles,
                maxDownloads: offer.digital.max_downloads
              }
            }
          : {}),
        ...(offer.physical
          ? {
              physical: {
                stock: offer.physical.stock,
                weightGrams: offer.physical.weight_grams,
                lengthCm: offer.physical.length_cm, widthCm: offer.physical.width_cm, heightCm: offer.physical.height_cm
              }
            }
          : {}),
        ...(offer.service
          ? {
              service: {
                serviceType: offer.service.service_type,
                estimatedHours: offer.service.estimated_hours,
                instructions: offer.service.instructions,
                inputs: this.serviceInputDefinitions(offer.service.input_schema)
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

  private toAdminProduct(product: AdminProductRecord) {
    return {
      id: product.id,
      currency: product.price_currency,
      title: product.title,
      slug: product.slug,
      description: product.description,
      tags: product.tags,
      category: categoryLabel(product.category_record),
      categoryId: product.category_record?.id ?? null,
      kind: product.kind,
      type: product.type,
      status: product.status,
      image: this.mapProductImage(product.media),
      listingCount: product._count.listings,
      seller: { id: product.created_by.id, shopName: product.created_by.shop_name },
      createdAt: product.created_at.toISOString(),
      updatedAt: product.updated_at.toISOString()
    };
  }

  private assertProductUpdate(input: UpdateProductDto) {
    if (!input.type && (input.confirmTypeChange !== undefined || input.typeChangeDigital || input.typeChangePhysical || input.typeChangeService)) {
      throw new BadRequestException("A product type is required when providing conversion details");
    }
    if (!Object.entries(input).some(([key, value]) => key !== "confirmTypeChange" && value !== undefined)) {
      throw new BadRequestException("At least one product field is required");
    }
  }

  private async changeProductType(
    tx: Prisma.TransactionClient,
    productId: string,
    currentType: string,
    currentStatus: string,
    input: UpdateProductDto
  ): Promise<boolean> {
    const nextType = input.type;
    if (!nextType || nextType === currentType) return false;
    if (!input.confirmTypeChange) throw new BadRequestException("Confirm the product type change and loss of existing fulfillment details");
    if (currentStatus === "trashed") throw new ConflictException("Restore the product before changing its type");
    if (currentType === "bridge" || nextType === "bridge") {
      throw new ConflictException("Bridge products require a provider binding and cannot be converted");
    }

    const offers = await tx.seller_offers.findMany({
      where: { listing: { product_id: productId } },
      select: {
        id: true,
        _count: { select: { order_items: true, inventory_reservations: true } },
        listing: { select: { seller_id: true } }
      }
    });
    if (offers.some((offer) => offer._count.order_items || offer._count.inventory_reservations)) {
      throw new ConflictException("Products with sales or inventory reservations cannot change type");
    }
    if (nextType === "physical") {
      const sellerIds = await tx.seller_listings.findMany({
        where: { product_id: productId }, select: { seller_id: true }
      });
      const product = await tx.products.findUniqueOrThrow({
        where: { id: productId }, select: { created_by_seller_id: true }
      });
      const required = new Set([product.created_by_seller_id, ...sellerIds.map((listing) => listing.seller_id)]);
      const grants = await tx.seller_permissions.findMany({
        where: { seller_id: { in: [...required] }, permission: "physical_products_manage" },
        select: { seller_id: true }
      });
      if (grants.length !== required.size) throw new ForbiddenException("Every attached seller needs physical-product access");
    }

    const details = {
      digital: input.typeChangeDigital,
      physical: input.typeChangePhysical,
      service: input.typeChangeService
    };
    if (Object.values(details).filter(Boolean).length !== Number(Boolean(details[nextType])) || (offers.length > 0 && !details[nextType])) {
      throw new BadRequestException(`Exactly one ${nextType} fulfillment object is required for existing offers`);
    }
    const offerIds = offers.map((offer) => offer.id);
    if (offerIds.length) {
      const where = { offer_id: { in: offerIds } };
      if (currentType === "digital") await tx.seller_offer_digital.deleteMany({ where });
      if (currentType === "physical") await tx.seller_offer_physical.deleteMany({ where });
      if (currentType === "service") await tx.seller_offer_service.deleteMany({ where });
      for (const offer of offers) {
        if (nextType === "digital" && input.typeChangeDigital) {
          const urls = input.typeChangeDigital.fileReferences ?? [input.typeChangeDigital.fileReference!];
          await tx.seller_offer_digital.create({ data: { offer_id: offer.id, file_reference: urls[0]!, file_references: urls, max_downloads: input.typeChangeDigital.maxDownloads } });
        }
        if (nextType === "physical" && input.typeChangePhysical) await tx.seller_offer_physical.create({ data: { offer_id: offer.id, stock: input.typeChangePhysical.stock, weight_grams: input.typeChangePhysical.weightGrams } });
        if (nextType === "service" && input.typeChangeService) await tx.seller_offer_service.create({ data: { offer_id: offer.id, service_type: this.clean(input.typeChangeService.serviceType), estimated_hours: input.typeChangeService.estimatedHours, instructions: this.cleanOptional(input.typeChangeService.instructions), input_schema: this.serviceInputSchema(input.typeChangeService.inputs) } });
      }
      await tx.seller_offers.updateMany({ where: { id: { in: offerIds } }, data: { status: "draft" } });
    }
    await tx.seller_listings.updateMany({ where: { product_id: productId }, data: { status: "draft" } });
    return true;
  }

  private async productUpdateData(tx: Prisma.TransactionClient, input: UpdateProductDto): Promise<Prisma.productsUpdateInput> {
    return {
      ...(input.title === undefined ? {} : { title: this.clean(input.title) }),
      ...(input.description === undefined
        ? {}
        : { description: normalizeProductDescription(input.description) }),
      ...(input.tags === undefined ? {} : { tags: [...new Set(input.tags.map((tag) => tag.trim()).filter(Boolean))] }),
      ...await productCategoryUpdate(tx,input),
      ...(input.type === undefined ? {} : { type: input.type }),
      ...(input.status === undefined ? {} : { status: input.status })
    };
  }

  private mapProductImage(
    media: { id: string; variants: Array<{ variant: string; width: number; height: number }> } | null
  ) {
    if (!media) return null;
    return {
      id: media.id,
      variants: media.variants.map((variant) => ({
        name: variant.variant as "thumb" | "large",
        url: `/media/${media.id}/${variant.variant}.webp`,
        width: variant.width,
        height: variant.height
      }))
    };
  }

  private toAdminProductDetail(
    product: AdminProductDetailRecord,
    listings: AdminListingRecord[],
    nextListingCursor: string | null
  ) {
    return {
      ...this.toAdminProduct(product),
      createdBy: {
        id: product.created_by.id,
        shopName: product.created_by.shop_name
      },
      options: product.options.map((option) => ({
        id: option.id,
        name: option.name,
        values: option.values
      })),
      variants: product.variants.map((variant) => ({
        id: variant.id,
        name: variant.name,
        options: this.mapVariantOptions(variant.option_values)
      })),
      listings: listings.map((listing) => ({
        id: listing.id,
        status: listing.status,
        seller: {
          id: listing.seller.id,
          shopName: listing.seller.shop_name
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
                  fileReferences: offer.digital.file_references.length ? offer.digital.file_references : [offer.digital.file_reference],
                  fileTitles: offer.digital.file_titles,
                  maxDownloads: offer.digital.max_downloads
                }
              }
            : {}),
          ...(offer.physical
            ? {
                physical: {
                  stock: offer.physical.stock,
                  weightGrams: offer.physical.weight_grams,
                  lengthCm: offer.physical.length_cm, widthCm: offer.physical.width_cm, heightCm: offer.physical.height_cm
                }
              }
            : {}),
          ...(offer.service
            ? {
                service: {
                  serviceType: offer.service.service_type,
                  estimatedHours: offer.service.estimated_hours,
                  instructions: offer.service.instructions,
                  inputs: this.serviceInputDefinitions(offer.service.input_schema)
                }
              }
            : {}),
          createdAt: offer.created_at.toISOString(),
          updatedAt: offer.updated_at.toISOString()
        })),
        createdAt: listing.created_at.toISOString(),
        updatedAt: listing.updated_at.toISOString()
      })),
      nextListingCursor
    };
  }

  private async recordProductChange(
    tx: Prisma.TransactionClient,
    productId: string,
    actorUserId: string,
    action: "create" | "update" | "review" | "restore",
    beforeRecord: ProductSnapshot | ProductSnapshotRecord | null,
    afterRecord: ProductSnapshot | ProductSnapshotRecord,
    restoredFromEventId?: string,
    bulkOperationId?: string
  ) {
    const before = beforeRecord ? this.productSnapshot(beforeRecord) : null;
    const after = this.productSnapshot(afterRecord);
    const changedFields = before
      ? productSnapshotFields.filter((field) => field === "category" && before.categoryId !== undefined && after.categoryId !== undefined
        ? before.categoryId !== after.categoryId
        : field === "type" && (before.type === undefined || after.type === undefined)
          ? false
          : field === "tags" ? JSON.stringify(before.tags ?? []) !== JSON.stringify(after.tags ?? []) : before[field] !== after[field])
      : [...productSnapshotFields];
    await tx.product_change_events.create({
      data: {
        product_id: productId,
        actor_user_id: actorUserId,
        action,
        changed_fields: changedFields,
        ...(before ? { before_snapshot: before as Prisma.InputJsonValue } : {}),
        after_snapshot: after as Prisma.InputJsonValue,
        ...(restoredFromEventId ? { restored_from_event_id: restoredFromEventId } : {}),
        ...(bulkOperationId ? { bulk_operation_id: bulkOperationId } : {})
      }
    });
  }

  private assertBulkUndoSelector(input: PreviewBulkUndoProductChangesDto) {
    if (input.mode === "after_time" && !input.after) {
      throw new BadRequestException("An after timestamp is required for time-based bulk undo");
    }
    if (input.mode === "last" && input.after) {
      throw new BadRequestException("An after timestamp is only valid for time-based bulk undo");
    }
  }

  private bulkUndoWhere(
    input: PreviewBulkUndoProductChangesDto
  ): Prisma.product_change_eventsWhereInput {
    const filters: Prisma.product_change_eventsWhereInput[] = [];
    if (input.actions?.length) filters.push({ action: { in: input.actions } });
    if (input.productTypes?.length) {
      filters.push({ product: { type: { in: input.productTypes } } });
    }
    if (input.sellerIds?.length) {
      filters.push({ product: { created_by_seller_id: { in: input.sellerIds } } });
    }
    const required: Prisma.product_change_eventsWhereInput[] = [
      { bulk_operation_id: null },
      { before_snapshot: { not: Prisma.DbNull } },
      { changed_fields: { isEmpty: false } },
      { NOT: { changed_fields: { hasSome: ["seller", "type"] } } },
      ...(input.mode === "after_time" ? [{ created_at: { gt: new Date(input.after!) } }] : [])
    ];
    if (filters.length) {
      required.push(input.operator === "or" ? { OR: filters } : { AND: filters });
    }
    return { AND: required };
  }

  private async productFieldsFromSnapshot(
    tx: Prisma.TransactionClient,
    snapshot: ProductSnapshot,
    changedFields: string[]
  ): Promise<Prisma.productsUpdateInput> {
    const selected = new Set(changedFields);
    if (selected.has("type")) throw new ConflictException("A product type conversion cannot be undone without restoring its offer fulfillment details");
    const data: Prisma.productsUpdateInput = {};
    if (selected.has("title")) data.title = snapshot.title;
    if (selected.has("slug")) {
      if (!snapshot.slug) {
        throw new ConflictException("The saved product slug is no longer restorable");
      }
      data.slug = snapshot.slug;
    }
    if (selected.has("description")) data.description = snapshot.description;
    if (selected.has("tags")) {
      if (!snapshot.tags) throw new ConflictException("The saved product tags are no longer restorable");
      data.tags = snapshot.tags;
    }
    if (selected.has("category")) Object.assign(data, await productCategoryUpdate(tx, snapshot.categoryId !== undefined ? { categoryId: snapshot.categoryId } : { category: snapshot.category }));
    if (selected.has("status")) data.status = snapshot.status;
    if (!Object.keys(data).length) {
      throw new ConflictException("A selected change has no restorable product fields");
    }
    return data;
  }

  private changedProductFieldsMatch(
    currentRecord: ProductSnapshot | ProductSnapshotRecord,
    expected: ProductSnapshot,
    changedFields: string[]
  ) {
    const current = this.productSnapshot(currentRecord);
    const selected = new Set(changedFields);
    return (
      (!selected.has("title") || current.title === expected.title) &&
      (!selected.has("slug") || current.slug === expected.slug) &&
      (!selected.has("description") || current.description === expected.description) &&
      (!selected.has("tags") || JSON.stringify(current.tags ?? []) === JSON.stringify(expected.tags ?? [])) &&
      (!selected.has("category") || (expected.categoryId !== undefined
        ? current.categoryId === expected.categoryId
        : current.category === expected.category)) &&
      (!selected.has("status") || current.status === expected.status)
    );
  }

  private productSnapshot(record: ProductSnapshot | ProductSnapshotRecord): ProductSnapshot {
    return {
      title: record.title,
      ...(record.type ? { type: record.type } : {}),
      ...(record.slug ? { slug: record.slug } : {}),
      description: record.description,
      ...(record.tags !== undefined ? { tags: record.tags } : {}),
      category: "category_record" in record ? categoryLabel(record.category_record) : record.category,
      ...("category_record" in record ? { categoryId: record.category_record?.id ?? null } : record.categoryId !== undefined ? { categoryId: record.categoryId } : {}),
      status: record.status
    };
  }

  private readProductSnapshot(value: Prisma.JsonValue): ProductSnapshot {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new ConflictException("The saved product version is no longer restorable");
    }
    const status = value.status;
    if (
      typeof value.title !== "string" ||
      value.title.length < 2 ||
      value.title.length > 200 ||
      (value.slug !== undefined &&
        (typeof value.slug !== "string" ||
          value.slug.length > 200 ||
          !/^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u.test(value.slug))) ||
      (value.description !== null && typeof value.description !== "string") ||
      (value.tags !== undefined && (!Array.isArray(value.tags) || value.tags.length > 500 || !value.tags.every((tag) => typeof tag === "string" && tag.length <= 50))) ||
      (value.type !== undefined && !["digital", "physical", "service", "bridge"].includes(String(value.type))) ||
      (value.category !== null && typeof value.category !== "string") ||
      !["draft", "pending_review", "active", "archived"].includes(String(status))
    ) {
      throw new ConflictException("The saved product version is no longer restorable");
    }
    return {
      title: value.title,
      ...(typeof value.type === "string" ? { type: value.type as ProductSnapshot["type"] } : {}),
      ...(typeof value.slug === "string" ? { slug: value.slug } : {}),
      description: value.description as string | null,
      ...(Array.isArray(value.tags) ? { tags: value.tags as string[] } : {}),
      category: value.category as string | null,
      ...(typeof value.categoryId === "string" || value.categoryId === null ? { categoryId: value.categoryId } : {}),
      status: status as ProductSnapshot["status"]
    };
  }

  private toProductChange(
    event: Prisma.product_change_eventsGetPayload<{ select: typeof productChangeSelect }>
  ) {
    return {
      id: event.id,
      action: event.action,
      changedFields: event.changed_fields,
      before: event.before_snapshot,
      after: event.after_snapshot,
      restoredFromChangeId: event.restored_from_event_id,
      bulkOperationId: event.bulk_operation_id,
      actor: {
        id: event.actor.id,
        name: event.actor.full_name,
        role: event.actor.role.replaceAll("_", "-")
      },
      product: {
        id: event.product.id,
        title: event.product.title,
        slug: event.product.slug,
        type: event.product.type,
        seller: {
          id: event.product.created_by.id,
          shopName: event.product.created_by.shop_name
        }
      },
      createdAt: event.created_at.toISOString()
    };
  }

  private rethrowWriteError(error: unknown): never {
    if (
      error instanceof BadRequestException ||
      error instanceof NotFoundException ||
      error instanceof ConflictException
    ) {
      throw error;
    }
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2010" && error.meta?.code === "23505") {
      if (String(error.meta?.message ?? "").includes("product_slug_routes_pkey") || String(error.meta?.message ?? "").includes("Product slug is already reserved")) {
        throw new ConflictException("The product slug is already reserved");
      }
      throw new ConflictException("A product value already exists");
    }
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      if (String(error.meta?.target ?? "").includes("slug")) {
        throw new ConflictException("The product slug is already reserved");
      }
      throw new ConflictException(
        "The slug, seller SKU, variant combination, or seller offer already exists"
      );
    }
    throw error;
  }

  async productSlugAvailability(slug: string, currentProductId?: string, sellerId?: string) {
    const normalizedSlug = this.slugify(slug);
    if (!normalizedSlug || normalizedSlug !== slug) {
      throw new BadRequestException("A normalized product slug is required");
    }
    const route = await this.prisma.product_slug_routes.findUnique({
      where: { slug: normalizedSlug }, select: { product_id: true }
    });
    if (!route) return { available: true };
    if (route.product_id !== currentProductId) return { available: false };
    if (!sellerId) return { available: true };
    const owned = await this.prisma.products.findFirst({
      where: { id: currentProductId, created_by_seller_id: sellerId }, select: { id: true }
    });
    return { available: Boolean(owned) };
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
        '"seller_offer_service_fulfillment_check", ' +
        '"seller_offer_bridge_fulfillment_check" IMMEDIATE'
    );
  }

  private async validateBridgeInput(sellerId: string, input: CreateProductDto) {
    if (!input.bridge) throw new BadRequestException("Bridge products require a Bridge fulfillment object");
    if (input.bridge.minimumQuantity > input.bridge.maximumQuantity) {
      throw new BadRequestException("Minimum quantity cannot exceed maximum quantity");
    }
    const grant = await this.prisma.bridge_service_grants.findFirst({
      where: {
        id: input.bridge.grantId,
        seller_id: sellerId,
        status: "active",
        service: { available: true, connection: { status: "active" } }
      },
      include: { service: true }
    });
    if (!grant) throw new ForbiddenException("An active Bridge service grant is required");
    const fields = this.jsonArray(grant.service.field_schema);
    const keys = new Set(fields.map((item) => typeof item.key === "string" ? item.key : ""));
    const labelKeys = new Set<string>();
    for (const label of input.bridge.fieldLabels) {
      if (!keys.has(label.key)) throw new BadRequestException(`Unknown Bridge field label key: ${label.key}`);
      if (labelKeys.has(label.key)) throw new BadRequestException(`Duplicate Bridge field label key: ${label.key}`);
      labelKeys.add(label.key);
    }
    if (grant.service.kind === "file" && input.bridge.mode === "automatic") {
      throw new BadRequestException("File services require manual fulfillment in this release");
    }
    return grant;
  }

  private applyFieldLabels(schema: Prisma.JsonValue, rawLabels: Prisma.JsonValue) {
    const labels = new Map(
      this.jsonArray(rawLabels).map((item) => [String(item.key ?? ""), item])
    );
    return this.jsonArray(schema).map((item) => {
      const override = labels.get(String(item.key ?? ""));
      return {
        ...item,
        ...(override?.label ? { label: String(override.label) } : {}),
        ...(override?.placeholder ? { placeholder: String(override.placeholder) } : {}),
        ...(override?.helpText ? { helpText: String(override.helpText) } : {})
      };
    });
  }

  private serviceInputSchema(inputs: ServiceInputDefinitionDto[] | undefined) {
    return (inputs ?? []).map((field) => {
      const minimumLength = field.minimumLength ?? 0;
      const maximumLength = field.maximumLength ?? 2_000;
      if (minimumLength > maximumLength) {
        throw new BadRequestException(`Minimum length cannot exceed maximum length for ${field.key}`);
      }
      return {
        key: field.key,
        label: this.clean(field.label),
        type: field.type,
        required: field.required,
        minimumLength,
        maximumLength,
        ...(this.cleanOptional(field.placeholder) ? { placeholder: this.cleanOptional(field.placeholder) } : {}),
        ...(this.cleanOptional(field.helpText) ? { helpText: this.cleanOptional(field.helpText) } : {})
      };
    });
  }

  private serviceInputDefinitions(value: Prisma.JsonValue) {
    return this.jsonArray(value).flatMap((field) => {
      if (
        typeof field.key !== "string" ||
        typeof field.label !== "string" ||
        !["text", "textarea", "password"].includes(String(field.type)) ||
        typeof field.required !== "boolean"
      ) return [];
      return [{
        key: field.key,
        label: field.label,
        type: field.type as "text" | "textarea" | "password",
        required: field.required,
        ...(typeof field.placeholder === "string" ? { placeholder: field.placeholder } : {}),
        ...(typeof field.helpText === "string" ? { helpText: field.helpText } : {}),
        ...(typeof field.minimumLength === "number" ? { minimumLength: field.minimumLength } : {}),
        ...(typeof field.maximumLength === "number" ? { maximumLength: field.maximumLength } : {})
      }];
    });
  }

  private jsonArray(value: Prisma.JsonValue): Array<Record<string, Prisma.JsonValue>> {
    return Array.isArray(value)
      ? value.filter((item): item is Record<string, Prisma.JsonValue> => Boolean(item) && typeof item === "object" && !Array.isArray(item))
      : [];
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

  private bridgeEnabled() {
    return this.config.get<string>("BRIDGE_FEATURE_ENABLED") === "true";
  }
}
