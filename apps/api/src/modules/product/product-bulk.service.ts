import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import { createHash } from "node:crypto";
import { Prisma } from "../../prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { ApplyProductBulkEditDto, PreviewProductBulkEditDto } from "./dto/product.dto";

const bulkProductSelect = {
  id: true, title: true, type: true, status: true, category_id: true, created_by_seller_id: true,
  tags: true, updated_at: true,
  category_record: { select: { name: true } },
  created_by: { select: { shop_name: true } },
  bridge_binding: { select: { schema_review_needed: true } },
  listings: { select: {
    id: true, seller_id: true, updated_at: true,
    offers: { select: {
      id: true, price: true, currency: true, updated_at: true,
      physical: { select: { stock: true } },
      _count: { select: { order_items: true, inventory_reservations: true } }
    } }
  } }
} satisfies Prisma.productsSelect;

type BulkProduct = Prisma.productsGetPayload<{ select: typeof bulkProductSelect }>;
type BulkDb = Pick<Prisma.TransactionClient, "products" | "sellers" | "product_categories">;
type BulkInput = PreviewProductBulkEditDto;

function digest(value: unknown) {
  return createHash("sha256").update(JSON.stringify(value)).digest("hex");
}

function normalizedTag(value: string) {
  return value.trim().replace(/\s+/gu, " ");
}

@Injectable()
export class ProductBulkService {
  constructor(private readonly prisma: PrismaService) {}

  async preview(input: PreviewProductBulkEditDto) {
    const plan = await this.plan(this.prisma, input);
    return { action: plan.action, productCount: plan.productCount, offerCount: plan.offerCount, items: plan.items, revision: plan.revision };
  }

  async apply(input: ApplyProductBulkEditDto, actorUserId: string) {
    const requestHash = digest(this.request(input));
    try {
      return await this.prisma.$transaction(async (tx) => {
        const previous = await tx.product_bulk_operations.findUnique({ where: { id: input.operationId }, select: { actor_user_id: true, request_hash: true, product_count: true, offer_count: true } });
        if (previous) {
          if (previous.actor_user_id !== actorUserId || previous.request_hash !== requestHash) throw new ConflictException("Bulk operation ID was already used");
          return { operationId: input.operationId, productCount: previous.product_count, offerCount: previous.offer_count, replayed: true };
        }
        const plan = await this.plan(tx, input);
        if (plan.revision !== input.revision) throw new ConflictException("Products changed since the preview. Preview again before applying.");
        const ids = input.productIds;
        const now = new Date();
        switch (input.action) {
          case "status":
          case "trash":
            if ((await tx.products.updateMany({ where: { id: { in: ids } }, data: { status: input.action === "trash" ? "trashed" : input.status! } })).count !== ids.length) {
              throw new ConflictException("Selection changed during the bulk edit");
            }
            break;
          case "category":
            if ((await tx.products.updateMany({ where: { id: { in: ids } }, data: { category_id: input.categoryId ?? null } })).count !== ids.length) {
              throw new ConflictException("Selection changed during the bulk edit");
            }
            break;
          case "tags_add":
          case "tags_remove":
            for (const item of plan.records) {
              const tag = normalizedTag(input.tag!);
              const tags = input.action === "tags_add"
                ? item.tags.some((existing) => existing.toLocaleLowerCase() === tag.toLocaleLowerCase()) ? item.tags : [...item.tags, tag]
                : item.tags.filter((existing) => existing.toLocaleLowerCase() !== tag.toLocaleLowerCase());
              await tx.products.update({ where: { id: item.id }, data: { tags } });
            }
            break;
          case "seller":
            for (const item of plan.records) {
              await tx.seller_listings.update({ where: { id: item.listings[0]!.id }, data: { seller_id: input.sellerId! } });
            }
            await tx.products.updateMany({ where: { id: { in: ids } }, data: { created_by_seller_id: input.sellerId! } });
            break;
          case "stock":
            if ((await tx.seller_offer_physical.updateMany({ where: { offer: { listing: { product_id: { in: ids } } } }, data: { stock: input.stock! } })).count !== plan.offerCount) {
              throw new ConflictException("Offers changed during the bulk edit");
            }
            await tx.products.updateMany({ where: { id: { in: ids } }, data: { updated_at: now } });
            break;
          case "price":
          case "price_percent":
            for (const item of plan.records) for (const listing of item.listings) for (const offer of listing.offers) {
              await tx.seller_offers.update({ where: { id: offer.id }, data: { price: this.nextPrice(offer.price, input) } });
            }
            await tx.products.updateMany({ where: { id: { in: ids } }, data: { updated_at: now } });
            break;
        }
        await tx.product_bulk_operations.create({ data: {
          id: input.operationId, actor_user_id: actorUserId, action: input.action,
          request_hash: requestHash, product_count: plan.productCount, offer_count: plan.offerCount,
          before_state: plan.items.map((item) => ({ id: item.id, before: item.before })) as Prisma.InputJsonValue,
          after_state: plan.items.map((item) => ({ id: item.id, after: item.after })) as Prisma.InputJsonValue
        } });
        return { operationId: input.operationId, productCount: plan.productCount, offerCount: plan.offerCount, replayed: false };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, timeout: 15000 });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && (error.code === "P2034" || error.code === "P2002")) {
        throw new ConflictException("Products changed while applying the bulk edit. Preview again.");
      }
      throw error;
    }
  }

  private request(input: BulkInput) {
    return {
      productIds: [...input.productIds].sort(), action: input.action,
      status: input.status, categoryId: input.categoryId, sellerId: input.sellerId,
      stock: input.stock, price: input.price, percent: input.percent, tag: input.tag
    };
  }

  private nextPrice(current: Prisma.Decimal, input: BulkInput) {
    const amount = input.action === "price" ? new Prisma.Decimal(input.price!)
      : current.mul(new Prisma.Decimal(100).add(input.percent!)).div(100).toDecimalPlaces(5, Prisma.Decimal.ROUND_HALF_UP);
    if (amount.isNegative() || amount.gte("10000000000000000")) throw new BadRequestException("Resulting price is outside the supported range");
    return amount;
  }

  private validate(input: BulkInput) {
    const expected: Record<BulkInput["action"], keyof BulkInput | null> = {
      status: "status", category: "categoryId", seller: "sellerId", stock: "stock",
      price: "price", price_percent: "percent", tags_add: "tag", tags_remove: "tag", trash: null
    };
    const fields = ["status", "categoryId", "sellerId", "stock", "price", "percent", "tag"] as const;
    if (fields.some((field) => field !== expected[input.action] && input[field] !== undefined) ||
        (expected[input.action] && input[expected[input.action]!] === undefined)) {
      throw new BadRequestException("Specify exactly the value required by the bulk action");
    }
    if (input.action === "status" && input.status === "trashed") throw new BadRequestException("Use the trash action");
    if (input.action === "price_percent" && new Prisma.Decimal(input.percent!).lt(-100)) throw new BadRequestException("Price reduction cannot exceed 100 percent");
    if ((input.action === "tags_add" || input.action === "tags_remove") && !normalizedTag(input.tag!)) throw new BadRequestException("Tag cannot be blank");
  }

  private async plan(db: BulkDb, input: BulkInput) {
    this.validate(input);
    const records = await db.products.findMany({ where: { id: { in: input.productIds } }, select: bulkProductSelect, orderBy: { id: "asc" } });
    if (records.length !== input.productIds.length) throw new NotFoundException("One or more selected products were not found");
    const offerCount = records.reduce((total, item) => total + item.listings.reduce((sum, listing) => sum + listing.offers.length, 0), 0);
    if (offerCount > 500) throw new BadRequestException("Select products with no more than 500 offers per operation");
    if (input.action === "price" && new Set(records.flatMap((item) => item.listings.flatMap((listing) => listing.offers.map((offer) => offer.currency.trim())))).size > 1) {
      throw new BadRequestException("A fixed price requires offers in one currency. Select one currency at a time.");
    }
    let target = "";
    if (input.action === "category" && input.categoryId) {
      const category = await db.product_categories.findUnique({ where: { id: input.categoryId }, select: { name: true } });
      if (!category) throw new NotFoundException("Category was not found");
      target = category.name;
    }
    if (input.action === "seller") {
      const seller = await db.sellers.findUnique({ where: { id: input.sellerId }, select: { shop_name: true, approved: true, invited: true, suspended_at: true, merged_into_seller_id: true, permissions: { select: { permission: true } } } });
      if (!seller || !seller.approved || seller.invited || seller.suspended_at || seller.merged_into_seller_id) throw new BadRequestException("Select an approved, active seller");
      for (const item of records) {
        const requiredPermission = item.type === "physical" ? "physical_products_manage" : "products_manage";
        if (!seller.permissions.some(({ permission }) => permission === requiredPermission)) {
          throw new BadRequestException(`Destination seller cannot manage ${item.title}`);
        }
      }
      target = seller.shop_name;
    }
    const items = records.map((item) => this.planItem(item, input, target));
    const state = records.map((item) => ({
      id: item.id, status: item.status, categoryId: item.category_id, sellerId: item.created_by_seller_id,
      tags: item.tags, updatedAt: item.updated_at.toISOString(),
      listings: item.listings.map((listing) => ({ id: listing.id, sellerId: listing.seller_id, updatedAt: listing.updated_at.toISOString(),
        offers: listing.offers.map((offer) => ({ id: offer.id, price: offer.price.toString(), currency: offer.currency, updatedAt: offer.updated_at.toISOString(), stock: offer.physical?.stock,
          orders: offer._count.order_items, reservations: offer._count.inventory_reservations })) }))
    }));
    return { action: input.action, productCount: records.length, offerCount, items, revision: digest({ request: this.request(input), state }), records };
  }

  private planItem(item: BulkProduct, input: BulkInput, target: string) {
    const offers = item.listings.flatMap((listing) => listing.offers);
    const before = input.action === "status" || input.action === "trash" ? item.status
      : input.action === "category" ? item.category_record?.name ?? "—"
      : input.action === "seller" ? item.created_by.shop_name
      : input.action.startsWith("tags_") ? item.tags.join(", ") || "—"
      : input.action === "stock" ? offers.map((offer) => offer.physical?.stock).join(", ")
      : offers.map((offer) => `${offer.price.toString()} ${offer.currency}`).join(", ");
    if (input.action === "status" && input.status === "active" && item.bridge_binding?.schema_review_needed) throw new ConflictException(`Bridge product ${item.title} requires schema review`);
    if (input.action === "seller" && (item.status === "trashed" || item.type === "bridge" || item.created_by_seller_id === input.sellerId || item.listings.length !== 1 || item.listings[0]!.seller_id !== item.created_by_seller_id ||
      offers.some((offer) => offer._count.order_items || offer._count.inventory_reservations))) {
      throw new ConflictException(`Product ${item.title} is linked to Bridge, multiple sellers, or commercial history and cannot be transferred`);
    }
    if ((input.action === "price" || input.action === "price_percent" || input.action === "stock") && !offers.length) throw new BadRequestException(`Product ${item.title} has no offers`);
    if (input.action === "stock" && offers.some((offer) => !offer.physical)) throw new BadRequestException(`Product ${item.title} has non-physical offers`);
    if (input.action === "tags_add" && item.tags.length >= 20 && !item.tags.some((tag) => tag.toLocaleLowerCase() === normalizedTag(input.tag!).toLocaleLowerCase())) throw new BadRequestException(`Product ${item.title} already has 20 tags`);
    const after = input.action === "status" ? input.status!
      : input.action === "trash" ? "trashed"
      : input.action === "category" ? target || "—"
      : input.action === "seller" ? target
      : input.action === "tags_add" ? (item.tags.some((tag) => tag.toLocaleLowerCase() === normalizedTag(input.tag!).toLocaleLowerCase()) ? item.tags : [...item.tags, normalizedTag(input.tag!)]).join(", ")
      : input.action === "tags_remove" ? item.tags.filter((tag) => tag.toLocaleLowerCase() !== normalizedTag(input.tag!).toLocaleLowerCase()).join(", ") || "—"
      : input.action === "stock" ? `${input.stock} × ${offers.length}`
      : offers.map((offer) => `${this.nextPrice(offer.price, input).toString()} ${offer.currency}`).join(", ");
    return { id: item.id, title: item.title, before, after, offerCount: offers.length };
  }
}
