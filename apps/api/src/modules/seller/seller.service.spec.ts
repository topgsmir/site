import { strict as assert } from "node:assert";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import { describe, it } from "node:test";
import type { AuthService } from "../auth/auth.service";
import type { PrismaService } from "../../prisma/prisma.service";
import { SellerService } from "./seller.service";

describe("SellerService public directory", () => {
  it("includes a 20-seller directory instead of truncating it to six profiles", async () => {
    const sellers = Array.from({ length: 20 }, (_, index) => ({
      id: `seller-${index}`,
      shop_name: `Shop ${index}`,
      profile_name: null,
      profile_specialty: null,
      goghdi_agent_id: index % 2 === 0 ? "507f1f77bcf86cd799439011" : null,
      profile_media: null,
      _count: { listings: index }
    }));
    const prisma = {
      sellers: {
        findMany: async ({ take }: { take: number }) => {
          assert.ok(take >= 20 && take <= 50, "The public directory must be large enough and bounded");
          return sellers.slice(0, take);
        }
      }
    } as unknown as PrismaService;

    const result = await new SellerService(prisma, {} as AuthService).listPublicSellers();
    assert.equal(result.length, 20);
    assert.equal(result[19].name, "Shop 19");
  });

  it("returns only display-safe seller fields and scopes the query to active sellers", async () => {
    let query: Record<string, unknown> | undefined;
    const prisma = {
      sellers: {
        findMany: async (input: Record<string, unknown>) => {
          query = input;
          return [
            {
              id: "seller-1",
              shop_name: "Repair Lab",
              profile_name: "مریم رضایی",
              profile_specialty: "تعمیرات برد سامسونگ",
              goghdi_agent_id: "507f1f77bcf86cd799439011",
              profile_media: null,
              _count: { listings: 3 }
            }
          ];
        }
      }
    } as unknown as PrismaService;
    const auth = {} as AuthService;

    const result = await new SellerService(prisma, auth).listPublicSellers();

    assert.deepEqual(query?.where, {
      invited: false,
      approved: true,
      suspended_at: null
    });
    assert.deepEqual(result, [
      {
        id: "seller-1",
        name: "مریم رضایی",
        specialty: "تعمیرات برد سامسونگ",
        profilePicture: null,
        activeProductCount: 3,
        chatAvailable: true
      }
    ]);
    assert.deepEqual(Object.keys(result[0]).sort(), [
      "activeProductCount",
      "chatAvailable",
      "id",
      "name",
      "profilePicture",
      "specialty"
    ]);
  });

  it("keeps profile updates seller-admin scoped and maps only public settings", async () => {
    let update: Record<string, unknown> | undefined;
    const saved = {
      id: "seller-1",
      shop_name: "Repair Lab",
      profile_name: "مریم رضایی",
      profile_specialty: "تعمیرات برد سامسونگ",
      profile_bio: null,
      profile_media: null,
      updated_at: new Date("2026-09-24T10:00:00.000Z")
    };
    const prisma = {
      sellers: {
        update: async (input: Record<string, unknown>) => {
          update = input;
          return saved;
        }
      }
    } as unknown as PrismaService;
    const service = new SellerService(prisma, {} as AuthService);

    await assert.rejects(
      () => service.updateOwnProfile("seller-1", "staff", { publicName: "Blocked" }),
      ForbiddenException
    );
    const result = await service.updateOwnProfile("seller-1", "admin", {
      publicName: "مریم رضایی",
      specialty: "تعمیرات برد سامسونگ",
      bio: null
    });

    assert.deepEqual(update?.where, {
      id: "seller-1",
      invited: false,
      approved: true,
      suspended_at: null
    });
    assert.deepEqual(result, {
      sellerId: "seller-1",
      shopName: "Repair Lab",
      publicName: "مریم رضایی",
      specialty: "تعمیرات برد سامسونگ",
      bio: null,
      profilePicture: null,
      updatedAt: "2026-09-24T10:00:00.000Z"
    });
  });
});

const sellerId = "11111111-1111-4111-8111-111111111111";
const textId = "22222222-2222-4222-8222-222222222222";
const productsId = "33333333-3333-4333-8333-333333333333";
const firstProductId = "44444444-4444-4444-8444-444444444444";
const secondProductId = "55555555-5555-4555-8555-555555555555";

describe("SellerService expert page", () => {
  it("lets a seller administrator save their own products in page order and hides anything not publicly buyable", async () => {
    let stored: unknown = [];
    let publicWhere: { created_by_seller_id?: string; id?: { in: string[] } } | undefined;
    const prisma = {
      $transaction: async (callback: (tx: unknown) => Promise<void>) => callback(prisma),
      sellers: {
        update: async (input: { data: { page_blocks: unknown } }) => {
          stored = input.data.page_blocks;
        },
        findFirst: async () => ({
          id: sellerId,
          shop_name: "Repair Lab",
          profile_name: "مریم رضایی",
          profile_specialty: "برد سامسونگ",
          profile_bio: "معرفی",
          page_blocks: stored,
          goghdi_agent_id: null,
          profile_media: null,
          _count: { listings: 2 }
        })
      },
      products: {
        findMany: async (input: { where: { created_by_seller_id?: string; id?: { in: string[] }; status?: unknown }; select?: { title?: boolean } }) => {
          if (input.where.status !== "active") {
            const ids = input.where.id?.in ?? [];
            return ids.filter((id) => id === firstProductId || id === secondProductId).map((id) => ({
              id,
              title: id === firstProductId ? "اول" : "دوم",
              slug: "file",
              status: "active",
              type: "digital"
            }));
          }
          publicWhere = input.where;
          return [{
            id: secondProductId,
            title: "فایل سامسونگ",
            translations: [],
            slug: "samsung-file",
            category_record: null,
            kind: "simple",
            type: "digital",
            price_currency: "TOMAN",
            created_at: new Date("2026-10-24T00:00:00.000Z"),
            media: null
          }];
        }
      },
      $queryRaw: async () => [{ product_id: secondProductId, currency: "TOMAN", price: { toString: () => "180000" } }]
    } as unknown as PrismaService;
    const service = new SellerService(prisma, {} as AuthService);

    await assert.rejects(
      () => service.updateOwnPage(sellerId, "staff", { blocks: [] }),
      ForbiddenException
    );
    await assert.rejects(
      () => service.updateOwnPage(sellerId, "admin", { blocks: [{
        id: productsId, type: "products", title: "فایل‌ها", productIds: [firstProductId, "66666666-6666-4666-8666-666666666666"]
      }] }),
      (error: unknown) => error instanceof BadRequestException && error.message === "Each product must still belong to your shop"
    );

    const saved = await service.updateOwnPage(sellerId, "admin", { blocks: [
      { id: textId, type: "text", title: "  تجربه  ", body: "تعمیر برد\n\n\nبا حوصله" },
      { id: productsId, type: "products", title: "فایل‌ها", productIds: [firstProductId, secondProductId] }
    ] });
    assert.deepEqual(saved.blocks[0], { id: textId, type: "text", title: "تجربه", body: "تعمیر برد\n\nبا حوصله" });
    assert.deepEqual(saved.products.map((product) => product.id), [firstProductId, secondProductId]);

    const profile = await service.getPublicSeller(sellerId, "fa");
    assert.equal(publicWhere?.created_by_seller_id, sellerId);
    assert.deepEqual(publicWhere?.id?.in, [firstProductId, secondProductId]);
    assert.equal(profile.page[0]?.type, "text");
    assert.deepEqual(profile.page[1], {
      id: productsId,
      type: "products",
      title: "فایل‌ها",
      products: [{
        id: secondProductId,
        availableLocales: ["fa"],
        title: "فایل سامسونگ",
        slug: "samsung-file",
        category: null,
        categoryId: null,
        kind: "simple",
        type: "digital",
        currency: "TOMAN",
        image: null,
        price: "180000",
        startingPrices: [{ currency: "TOMAN", price: "180000" }],
        createdAt: "2026-10-24T00:00:00.000Z"
      }]
    });
  });

  it("treats a damaged stored page as empty instead of failing the public profile", async () => {
    const prisma = {
      sellers: {
        findFirst: async () => ({
          id: sellerId,
          shop_name: "Repair Lab",
          profile_name: null,
          profile_specialty: null,
          profile_bio: null,
          page_blocks: { unexpected: true },
          goghdi_agent_id: null,
          profile_media: null,
          _count: { listings: 0 }
        })
      },
      products: { findMany: async () => { throw new Error("products should not be loaded"); } }
    } as unknown as PrismaService;
    const profile = await new SellerService(prisma, {} as AuthService).getPublicSeller(sellerId);
    assert.deepEqual(profile.page, []);
  });
});
