import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import type { ProductTranslationDraftDto } from "./dto/product-seo.dto";
import type { ProductTranslation } from "@topgsm/shared-types";

@Injectable()
export class ProductTranslationsService {
  constructor(private readonly prisma: PrismaService) {}

  async list(productId: string): Promise<ProductTranslation[]> {
    if (!await this.prisma.products.findUnique({ where: { id: productId }, select: { id: true } })) {
      throw new NotFoundException("Product was not found");
    }
    const rows = await this.prisma.product_translations.findMany({ where: { product_id: productId }, orderBy: { locale: "asc" } });
    return rows.map((row) => ({
      locale: row.locale as "en" | "ar",
      draft: { title: row.draft_title, description: row.draft_description, category: row.draft_category },
      published: row.published_at ? {
        title: row.published_title!, description: row.published_description!, category: row.published_category,
        publishedAt: row.published_at.toISOString()
      } : null,
      updatedAt: row.updated_at.toISOString()
    }));
  }

  async change(productId: string, locale: "en" | "ar", actorId: string, action: "draft" | "publish" | "unpublish", draft?: ProductTranslationDraftDto) {
    await this.prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`SELECT id FROM products WHERE id = ${productId}::uuid FOR UPDATE`;
      if (!locked.length) throw new NotFoundException("Product was not found");
      const where = { product_id_locale: { product_id: productId, locale } };
      if (action === "draft" && draft) {
        const data = { draft_title: draft.title.trim(), draft_description: draft.description.trim(), draft_category: draft.category?.trim() || null, updated_by: actorId };
        await tx.product_translations.upsert({ where, create: { product_id: productId, locale, ...data }, update: data });
      } else {
        const row = await tx.product_translations.findUnique({ where });
        if (!row) throw new NotFoundException("Translation was not found");
        if (action === "publish" && (row.draft_title.trim().length < 2 || !row.draft_description.trim())) {
          throw new BadRequestException("A translated title and description are required before publishing");
        }
        await tx.product_translations.update({ where, data: {
          published_title: action === "publish" ? row.draft_title : null,
          published_description: action === "publish" ? row.draft_description : null,
          published_category: action === "publish" ? row.draft_category : null,
          published_at: action === "publish" ? new Date() : null,
          updated_by: actorId
        } });
        await tx.products.update({ where: { id: productId }, data: { updated_at: new Date() } });
      }
    });
    return this.list(productId);
  }
}
