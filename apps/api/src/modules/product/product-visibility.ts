import { Prisma } from "../../prisma/client";

export const activeOfferWhere: Prisma.seller_offersWhereInput = {
  status: "active",
  listing: {
    status: "active",
    seller: { invited: false, approved: true, suspended_at: null },
    product: {
      OR: [
        { type: { not: "bridge" } },
        {
          type: "bridge",
          bridge_binding: {
            is: {
              schema_review_needed: false,
              OR: [
                { grant: { status: "active", service: { available: true, connection: { status: "active" } } } },
                { mode: "manual", grant: { status: "revoked" } }
              ]
            }
          }
        }
      ]
    }
  }
};

export function publicProductWhere(bridgeEnabled: boolean): Prisma.productsWhereInput {
  return { status: "active", ...(bridgeEnabled ? {} : { type: { not: "bridge" } }), variants: { some: { offers: { some: activeOfferWhere } } } };
}

export const publishedTranslationSelect = { locale: true, published_title: true, published_description: true, published_category: true, published_at: true } as const;
