import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { BadRequestException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { PrismaService } from "../../prisma/prisma.service";
import { ProductService } from "./product.service";

const PRODUCT_ID = "00000000-0000-4000-8000-000000000001";

function serviceWith(prisma: unknown) {
  return new ProductService(
    prisma as PrismaService,
    { get: () => undefined } as unknown as ConfigService
  );
}

describe("admin product editing", () => {
  it("updates an arbitrary catalog product and returns the admin summary", async () => {
    let updateInput: unknown;
    const updatedAt = new Date("2026-09-08T08:00:00.000Z");
    const service = serviceWith({
      products: {
        update: async (input: unknown) => {
          updateInput = input;
          return {
            id: PRODUCT_ID,
            title: "Clean title",
            slug: "catalog-product",
            description: "Clean description",
            category: null,
            kind: "simple",
            type: "service",
            status: "active",
            created_at: new Date("2026-09-01T08:00:00.000Z"),
            updated_at: updatedAt,
            _count: { listings: 3 }
          };
        }
      }
    });

    const result = await service.updateAdminProduct(PRODUCT_ID, {
      title: "  Clean   title  ",
      description: " Clean   description ",
      category: null,
      status: "active"
    });

    assert.deepEqual(updateInput, {
      where: { id: PRODUCT_ID },
      data: {
        title: "Clean title",
        description: "Clean description",
        category: null,
        status: "active"
      },
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
        updated_at: true,
        _count: { select: { listings: true } }
      }
    });
    assert.equal(result.description, "Clean description");
    assert.equal(result.listingCount, 3);
    assert.equal(result.updatedAt, updatedAt.toISOString());
  });

  it("rejects an empty patch", async () => {
    const service = serviceWith({ products: { update: async () => assert.fail() } });
    await assert.rejects(
      () => service.updateAdminProduct(PRODUCT_ID, {}),
      BadRequestException
    );
  });
});
