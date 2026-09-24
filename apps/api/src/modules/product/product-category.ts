import { BadRequestException, NotFoundException } from "@nestjs/common";
import { Prisma } from "../../prisma/client";

export const productCategorySelect = {
  id: true, name: true,
  translations: { select: { locale: true, name: true } }
} satisfies Prisma.product_categoriesSelect;

export type ProductCategoryRecord = Prisma.product_categoriesGetPayload<{ select: typeof productCategorySelect }>;

export function categoryLabel(category: ProductCategoryRecord | null, locale?: string, legacyLabel?: string | null) {
  return category?.translations.find((translation) => translation.locale === locale)?.name ?? legacyLabel ?? category?.name ?? null;
}

/** Resolve legacy labels at the boundary; all product membership uses IDs. */
export async function resolveProductCategory(tx: Prisma.TransactionClient, input: { categoryId?: string | null; category?: string | null }) {
  if (input.categoryId !== undefined && input.category !== undefined) {
    throw new BadRequestException("Supply categoryId or category, not both");
  }
  if (input.categoryId !== undefined) {
    if (input.categoryId === null) return null;
    const category = await tx.product_categories.findUnique({ where: { id: input.categoryId }, select: { id: true } });
    if (!category) throw new NotFoundException("Product category was not found");
    return category.id;
  }
  const name = input.category?.trim().replace(/\s+/gu, " ");
  if (!name) return null;
  const findExisting = async () => (await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    SELECT id FROM product_categories WHERE normalized_name=normalize_product_category(${name})
  `))[0];
  const existing = await findExisting();
  if (existing) return existing.id;
  // Avoid updating/locking a shared category for every product write. The unique
  // key handles concurrent first use; a fresh read sees the committed winner.
  const [created] = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
    INSERT INTO product_categories(name,normalized_name)
    VALUES (${name},normalize_product_category(${name}))
    ON CONFLICT (normalized_name) DO NOTHING
    RETURNING id
  `);
  const category = created ?? await findExisting();
  if (!category) throw new NotFoundException("Product category was not found");
  return category.id;
}

export async function productCategoryUpdate(tx: Prisma.TransactionClient, input: { categoryId?: string | null; category?: string | null }): Promise<Prisma.productsUpdateInput> {
  if (input.categoryId === undefined && input.category === undefined) return {};
  const id = await resolveProductCategory(tx,input);
  return { category_record: id ? { connect: { id } } : { disconnect: true } };
}
