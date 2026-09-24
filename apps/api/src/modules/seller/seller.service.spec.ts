import { strict as assert } from "node:assert";
import { ForbiddenException } from "@nestjs/common";
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
        activeProductCount: 3
      }
    ]);
    assert.deepEqual(Object.keys(result[0]).sort(), [
      "activeProductCount",
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
