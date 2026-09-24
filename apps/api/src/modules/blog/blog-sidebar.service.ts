import { BadRequestException, ConflictException, Injectable, NotFoundException } from "@nestjs/common";
import type { BlogSidebarContent, BlogSidebarDocument, BlogLocale, ProductStartingPrice } from "@topgsm/shared-types";
import { Prisma, type blog_locale } from "../../prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { SaveBlogSidebarDto } from "./blog-sidebar.dto";

function hasUnsafeUrlCharacter(value: string) {
  return Array.from(value).some((character) => {
    const code = character.codePointAt(0) ?? 0;
    return character === "\\" || /\s/u.test(character) || code <= 0x1f ||
      (code >= 0x7f && code <= 0x9f) ||
      (code >= 0x200b && code <= 0x200f) ||
      (code >= 0x202a && code <= 0x202e) ||
      (code >= 0x2060 && code <= 0x206f) || code === 0xfeff;
  });
}

export function validateBlogSidebarHref(value: string) {
  if (hasUnsafeUrlCharacter(value) || /%0[ad]|%5c/i.test(value)) {
    throw new BadRequestException("Invalid promotion destination URL");
  }
  if (/^\/(?!\/)/u.test(value)) return;
  try {
    const url = new URL(value);
    if (url.protocol === "https:" && !url.username && !url.password) return;
  } catch { /* Return a controlled validation error below. */ }
  throw new BadRequestException("Use a same-site path or an HTTPS URL for the promotion destination");
}

@Injectable()
export class BlogSidebarService {
  constructor(private readonly prisma: PrismaService) {}

  async get(locale: blog_locale): Promise<BlogSidebarDocument> {
    const row = await this.prisma.blog_sidebar_settings.findUnique({
      where: { locale },
      include: {
        products: {
          where: { product: { status: "active" } },
          orderBy: { position: "asc" },
          take: 3,
          include: {
            product: {
              include: {
                translations: {
                  where: { locale, published_at: { not: null } },
                  select: { published_title: true }
                },
                media: { include: { variants: true } },
                variants: {
                  include: {
                    offers: {
                      where: {
                        status: "active",
                        listing: { status: "active", seller: { approved: true, invited: false, suspended_at: null } }
                      },
                      select: { price: true, currency: true }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });
    if (!row) return { locale: locale as BlogLocale, version: 0, content: null, products: [], updatedAt: null };
    return {
      locale: locale as BlogLocale,
      version: row.version,
      content: {
        enabled: row.enabled,
        title: row.title,
        description: row.description,
        ctaLabel: row.cta_label,
        ctaHref: row.cta_href
      },
      products: row.products.map(({ product }) => ({
        id: product.id,
        title: product.translations[0]?.published_title ?? product.title,
        slug: product.slug,
        startingPrices: this.startingPrices(product),
        image: product.media ? {
          id: product.media.id,
          variants: product.media.variants.map((variant) => ({
            name: variant.variant as "thumb" | "large",
            url: `/media/${product.media!.id}/${variant.variant}.webp`,
            width: variant.width,
            height: variant.height
          }))
        } : null
      })),
      updatedAt: row.updated_at.toISOString()
    };
  }

  async save(locale: blog_locale, input: SaveBlogSidebarDto, actorId: string): Promise<BlogSidebarDocument> {
    const productIds = [...new Set(input.productIds)];
    if (productIds.length !== input.productIds.length) throw new BadRequestException("Each promoted product may be selected only once");
    validateBlogSidebarHref(input.content.ctaHref);
    if (productIds.length) {
      const count = await this.prisma.products.count({ where: { id: { in: productIds }, status: "active" } });
      if (count !== productIds.length) throw new NotFoundException("One or more promoted products are unavailable");
    }
    const content = this.normalizedContent(input.content);
    validateBlogSidebarHref(content.ctaHref);
    if (Array.from(content.title).length > 120 || Array.from(content.description).length > 500 || Array.from(content.ctaLabel).length > 60 || Array.from(content.ctaHref).length > 2048) {
      throw new BadRequestException("The normalized promotion content exceeds its allowed length");
    }
    const conflict = () => new ConflictException("The blog sidebar changed in another session. Reload before saving.");
    try {
      await this.prisma.$transaction(async (tx) => {
        if (input.version === 0) {
          await tx.blog_sidebar_settings.create({
            data: {
              locale,
              enabled: content.enabled,
              title: content.title,
              description: content.description,
              cta_label: content.ctaLabel,
              cta_href: content.ctaHref,
              updated_by_id: actorId
            }
          });
        } else {
          const updated = await tx.blog_sidebar_settings.updateMany({
            where: { locale, version: input.version },
            data: {
              enabled: content.enabled,
              title: content.title,
              description: content.description,
              cta_label: content.ctaLabel,
              cta_href: content.ctaHref,
              version: { increment: 1 },
              updated_by_id: actorId
            }
          });
          if (updated.count !== 1) throw conflict();
        }
        await tx.blog_sidebar_products.deleteMany({ where: { locale } });
        if (productIds.length) {
          await tx.blog_sidebar_products.createMany({
            data: productIds.map((productId, position) => ({ locale, product_id: productId, position }))
          });
        }
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") throw conflict();
      throw error;
    }
    return this.get(locale);
  }

  private normalizedContent(content: SaveBlogSidebarDto["content"]): BlogSidebarContent {
    const clean = (value: string) => value.normalize("NFKC").trim();
    return {
      enabled: content.enabled,
      title: clean(content.title),
      description: clean(content.description),
      ctaLabel: clean(content.ctaLabel),
      ctaHref: clean(content.ctaHref)
    };
  }

  private startingPrices(product: { variants: Array<{ offers: Array<{ price: Prisma.Decimal; currency: string }> }> }): ProductStartingPrice[] {
    const minimum = new Map<string, Prisma.Decimal>();
    for (const variant of product.variants) {
      for (const offer of variant.offers) {
        const currency = offer.currency.trim();
        const current = minimum.get(currency);
        if (!current || offer.price.lessThan(current)) minimum.set(currency, offer.price);
      }
    }
    return [...minimum.entries()].sort(([left], [right]) => left.localeCompare(right)).map(([currency, price]) => ({ currency, price: price.toString() }));
  }
}
