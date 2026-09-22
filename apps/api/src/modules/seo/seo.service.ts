import { Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";
import { publicProductWhere } from "../product/product-visibility";
import { publicBlogWhere } from "../blog/blog-visibility";
import type { Prisma } from "../../prisma/client";
import type { SitemapFeedDto } from "./seo.dto";

export const sitemapKinds = ["products", "posts", "categories", "tags", "sellers"] as const;
type Kind = typeof sitemapKinds[number];
type Locale = "fa" | "en" | "ar";

@Injectable()
export class SeoService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService) {}

  private where(locale: Locale) {
    const post = publicBlogWhere(locale);
    const product: Prisma.productsWhereInput = {
      ...publicProductWhere(this.config.get<string>("BRIDGE_FEATURE_ENABLED") === "true"),
      ...(locale === "fa" ? {} : { translations: { some: { locale, published_at: { not: null } } } })
    };
    return {
      products: product,
      posts: { locale, is_current: true, post } satisfies Prisma.blog_routesWhereInput,
      categories: { locale, category: { revisions: { some: { published_for: { is: post } } } } } satisfies Prisma.blog_category_translationsWhereInput,
      tags: { locale, tag: { revisions: { some: { revision: { published_for: { is: post } } } } } } satisfies Prisma.blog_tag_translationsWhereInput,
      sellers: { approved: true, invited: false, suspended_at: null, blog_posts: { some: post } } satisfies Prisma.sellersWhereInput
    };
  }

  async manifest() {
    const feeds: Array<{ kind: Kind; locale: Locale; count: number }> = [];
    for (const locale of ["fa", "en", "ar"] as const) {
      const where = this.where(locale);
      const counts = await Promise.all([
        this.prisma.products.count({ where: where.products }),
        this.prisma.blog_routes.count({ where: where.posts }),
        this.prisma.blog_category_translations.count({ where: where.categories }),
        this.prisma.blog_tag_translations.count({ where: where.tags }),
        this.prisma.sellers.count({ where: where.sellers })
      ]);
      sitemapKinds.forEach((kind, i) => feeds.push({ kind, locale, count: counts[i]! }));
    }
    return { feeds };
  }

  async feed(input: SitemapFeedDto) {
    const { kind, locale, cursor } = input;
    const where = this.where(locale);
    const after = cursor ? { id: { gt: cursor } } : {};
    const take = 1001;
    const orderBy = { id: "asc" as const };
    let rows: Array<{ id: string; path: string; updatedAt: string; alternates?: Record<string, string> }>;
    const path = (segment: string, slug: string) => `/${locale}/${segment}/${encodeURIComponent(slug)}`;
    switch (kind) {
      case "products": {
        const products = await this.prisma.products.findMany({ where: { ...where.products, ...after }, orderBy, take, select: {
          id: true, slug: true, updated_at: true,
          translations: { where: { published_at: { not: null } }, select: { locale: true, published_at: true } }
        } });
        rows = products.map((product) => ({
          id: product.id, path: path("products", product.slug), updatedAt: product.updated_at.toISOString(),
          alternates: Object.fromEntries(["fa", ...product.translations.map((t) => t.locale), "x-default"].map((code) => [code, `/${code === "x-default" ? "fa" : code}/products/${encodeURIComponent(product.slug)}`]))
        }));
        break;
      }
      case "posts": {
        const posts = await this.prisma.blog_routes.findMany({ where: { ...where.posts, ...after }, orderBy, take, select: { id: true, slug: true, post: { select: { updated_at: true } } } });
        rows = posts.map((row) => ({ id: row.id, path: path("blog", row.slug), updatedAt: row.post.updated_at.toISOString() }));
        break;
      }
      case "categories": {
        const categories = await this.prisma.blog_category_translations.findMany({ where: { ...where.categories, ...(cursor ? { category_id: { gt: cursor } } : {}) }, orderBy: { category_id: "asc" }, take, select: { category_id: true, slug: true, category: { select: { updated_at: true } } } });
        rows = categories.map((row) => ({ id: row.category_id, path: path("blog/category", row.slug), updatedAt: row.category.updated_at.toISOString() }));
        break;
      }
      case "tags": {
        const tags = await this.prisma.blog_tag_translations.findMany({ where: { ...where.tags, ...(cursor ? { tag_id: { gt: cursor } } : {}) }, orderBy: { tag_id: "asc" }, take, select: { tag_id: true, slug: true, tag: { select: { updated_at: true } } } });
        rows = tags.map((row) => ({ id: row.tag_id, path: path("blog/tag", row.slug), updatedAt: row.tag.updated_at.toISOString() }));
        break;
      }
      case "sellers": {
        const sellers = await this.prisma.sellers.findMany({ where: { ...where.sellers, ...after }, orderBy, take, select: { id: true, blog_posts: { where: publicBlogWhere(locale), orderBy: { updated_at: "desc" }, take: 1, select: { updated_at: true } } } });
        rows = sellers.map((row) => ({ id: row.id, path: path("blog/seller", row.id), updatedAt: row.blog_posts[0]!.updated_at.toISOString() }));
        break;
      }
      default: throw new NotFoundException();
    }
    const items = rows.slice(0, 1000);
    return { items, nextCursor: rows.length > 1000 ? items.at(-1)!.id : null };
  }
}
