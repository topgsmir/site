import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { BadRequestException } from "@nestjs/common";
import type { ConfigService } from "@nestjs/config";
import type { PrismaService } from "../../prisma/prisma.service";
import { ProductService } from "./product.service";

const PRODUCT_ID = "00000000-0000-4000-8000-000000000001";
const ACTOR_ID = "00000000-0000-4000-8000-000000000002";

function serviceWith(prisma: unknown) {
  return new ProductService(
    prisma as PrismaService,
    { get: () => undefined } as unknown as ConfigService
  );
}

describe("public product search", () => {
  it("matches multiple terms and Persian digit variants while retaining public visibility rules", async () => {
    let query: { where: { status: string; type: unknown; variants: unknown; AND: Array<{ OR: Array<{ title?: { contains: string }; slug?: { contains: string }; category?: { contains: string } }> }> } } | undefined;
    const service = serviceWith({ products: { findMany: async (input: typeof query) => { query = input; return []; } } });

    assert.deepEqual(await service.listPublic({ search: "آیفون ۱۵", limit: 8 }), []);
    assert.equal(query?.where.status, "active");
    assert.deepEqual(query?.where.type, { not: "bridge" });
    assert.ok(query?.where.variants);
    assert.equal(query?.where.AND.length, 2);
    const numberMatches = query?.where.AND[1].OR.flatMap((field) => [field.title?.contains, field.slug?.contains, field.category?.contains]);
    assert.ok(numberMatches?.includes("15"));
    assert.ok(numberMatches?.includes("۱۵"));
  });

  it("does not expose bridge products through the type filter when bridge is disabled", async () => {
    const service = serviceWith({ products: { findMany: async () => assert.fail("bridge search must not query products") } });
    assert.deepEqual(await service.listPublic({ type: "bridge", limit: 8 }), []);
  });
});

describe("managed product lists", () => {
  it("applies admin filters and a stable page order in the database", async () => {
    let query: Record<string, unknown> | undefined;
    const service = serviceWith({ products: { findMany: async (input: Record<string, unknown>) => { query = input; return []; } } });
    await service.listAdminProducts({ search: "phone", category: "accessories", status: "active", type: "physical", kind: "variable", sort: "title_asc", limit: 20 });
    assert.deepEqual(query?.where, {
      type: "physical", kind: "variable", status: "active",
      category: { contains: "accessories", mode: "insensitive" },
      OR: [
        { title: { contains: "phone", mode: "insensitive" } },
        { slug: { contains: "phone", mode: "insensitive" } },
        { category: { contains: "phone", mode: "insensitive" } }
      ]
    });
    assert.deepEqual(query?.orderBy, [{ title: "asc" }, { id: "desc" }]);
    assert.equal(query?.take, 21);
  });

  it("keeps filtered seller listings scoped to the authenticated seller", async () => {
    let query: Record<string, unknown> | undefined;
    const service = serviceWith({ seller_listings: { findMany: async (input: Record<string, unknown>) => { query = input; return []; } } });
    await service.listSellerListings(ACTOR_ID, { search: "charger", listingStatus: "active", status: "draft", sort: "created_desc", cursor: PRODUCT_ID, limit: 10 });
    assert.deepEqual(query?.where, {
      seller_id: ACTOR_ID,
      status: "active",
      product: { is: { status: "draft", OR: [
        { title: { contains: "charger", mode: "insensitive" } },
        { slug: { contains: "charger", mode: "insensitive" } },
        { category: { contains: "charger", mode: "insensitive" } }
      ] } }
    });
    assert.deepEqual(query?.cursor, { id: PRODUCT_ID });
    assert.equal(query?.skip, 1);
    assert.deepEqual(query?.orderBy, [{ created_at: "desc" }, { id: "desc" }]);
  });
});

describe("admin product editing", () => {
  it("updates an arbitrary catalog product and returns the admin summary", async () => {
    let updateInput: unknown;
    let changeInput: unknown;
    const updatedAt = new Date("2026-09-08T08:00:00.000Z");
    const service = serviceWith({
      $transaction: async (callback: (tx: unknown) => unknown) => callback({
        products: {
          findUnique: async () => ({
            title: "Old title",
            slug: "old-catalog-product",
            description: null,
            category: null,
            status: "draft"
          }),
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
        },
        product_change_events: { create: async (input: unknown) => { changeInput = input; return {}; } }
      }),
      products: {
        update: async () => assert.fail()
      }
    });

    const result = await service.updateAdminProduct(PRODUCT_ID, ACTOR_ID, {
      title: "  Clean   title  ",
      slug: "catalog-product",
      description: " Clean   description ",
      category: null,
      status: "active"
    });

    assert.deepEqual(updateInput, {
      where: { id: PRODUCT_ID },
      data: {
        title: "Clean title",
        slug: "catalog-product",
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
        media: {
          select: {
            id: true,
            variants: {
              orderBy: { variant: "asc" },
              select: { variant: true, width: true, height: true }
            }
          }
        },
        _count: { select: { listings: true } }
      }
    });
    assert.equal(result.description, "Clean description");
    assert.equal(result.listingCount, 3);
    assert.equal(result.updatedAt, updatedAt.toISOString());
    assert.deepEqual(changeInput, {
      data: {
        product_id: PRODUCT_ID,
        actor_user_id: ACTOR_ID,
        action: "update",
        changed_fields: ["title", "slug", "description", "status"],
        before_snapshot: {
          title: "Old title",
          slug: "old-catalog-product",
          description: null,
          category: null,
          status: "draft"
        },
        after_snapshot: {
          title: "Clean title",
          slug: "catalog-product",
          description: "Clean description",
          category: null,
          status: "active"
        }
      }
    });
  });

  it("restores a product snapshot and records the restore as a new event", async () => {
    let restoredData: unknown;
    let auditData: unknown;
    const summary = {
      id: PRODUCT_ID,
      title: "Earlier title",
      slug: "catalog-product",
      description: null,
      category: "Tools",
      kind: "simple",
      type: "service",
      status: "draft",
      created_at: new Date("2026-09-01T08:00:00.000Z"),
      updated_at: new Date("2026-09-09T08:00:00.000Z"),
      _count: { listings: 2 }
    };
    const service = serviceWith({
      $transaction: async (callback: (tx: unknown) => unknown) => callback({
        product_change_events: {
          findFirst: async () => ({
            id: "00000000-0000-4000-8000-000000000003",
            after_snapshot: { title: "Earlier title", description: null, category: "Tools", status: "draft" }
          }),
          create: async (input: { data: unknown }) => { auditData = input.data; return {}; }
        },
        products: {
          findUnique: async () => ({ title: "Current title", description: "Now", category: null, status: "active" }),
          update: async (input: { data: unknown }) => { restoredData = input.data; return summary; }
        }
      })
    });

    const result = await service.restoreProductChange(
      PRODUCT_ID,
      "00000000-0000-4000-8000-000000000003",
      ACTOR_ID
    );

    assert.deepEqual(restoredData, { title: "Earlier title", description: null, category: "Tools", status: "draft" });
    assert.equal((auditData as { action: string }).action, "restore");
    assert.equal((auditData as { restored_from_event_id: string }).restored_from_event_id, "00000000-0000-4000-8000-000000000003");
    assert.equal(result.title, "Earlier title");
  });

  it("bulk undo reverses only the fields changed by the selected event", async () => {
    const changeId = "00000000-0000-4000-8000-000000000003";
    const operationId = "00000000-0000-4000-8000-000000000004";
    let updateData: unknown;
    let auditData: unknown;
    const service = serviceWith({
      $transaction: async (callback: (tx: unknown) => unknown) => callback({
        $queryRaw: async () => [{ id: PRODUCT_ID }],
        product_change_events: {
          findMany: async (input: { where: { bulk_operation_id?: string } }) =>
            input.where.bulk_operation_id
              ? []
              : [{
                  id: changeId,
                  product_id: PRODUCT_ID,
                  changed_fields: ["title"],
                  before_snapshot: {
                    title: "Earlier title",
                    description: "Earlier description",
                    category: "Earlier category",
                    status: "draft"
                  },
                  after_snapshot: {
                    title: "Current title",
                    description: "Earlier description",
                    category: "Earlier category",
                    status: "draft"
                  }
                }],
          create: async (input: { data: unknown }) => { auditData = input.data; return {}; }
        },
        products: {
          findMany: async () => [{
            id: PRODUCT_ID,
            title: "Current title",
            description: "Current description",
            category: "Current category",
            status: "active",
            bridge_binding: null
          }],
          update: async (input: { data: unknown }) => {
            updateData = input.data;
            return {
              title: "Earlier title",
              description: "Current description",
              category: "Current category",
              status: "active"
            };
          }
        }
      })
    });

    const result = await service.bulkUndo({
      mode: "last",
      count: 100,
      operator: "and",
      operationId,
      changeIds: [changeId]
    }, ACTOR_ID);

    assert.deepEqual(updateData, { title: "Earlier title" });
    assert.equal((auditData as { bulk_operation_id: string }).bulk_operation_id, operationId);
    assert.equal((auditData as { restored_from_event_id: string }).restored_from_event_id, changeId);
    assert.equal(result.undoneCount, 1);
    assert.equal(result.affectedProductCount, 1);
  });

  it("does not overwrite a newer excluded edit to the same field", async () => {
    const service = serviceWith({
      $transaction: async (callback: (tx: unknown) => unknown) => callback({
        $queryRaw: async () => [{ id: PRODUCT_ID }],
        product_change_events: {
          findMany: async (input: { where: { bulk_operation_id?: string } }) =>
            input.where.bulk_operation_id
              ? []
              : [{
                  id: "00000000-0000-4000-8000-000000000003",
                  product_id: PRODUCT_ID,
                  changed_fields: ["title"],
                  before_snapshot: { title: "Old", description: null, category: null, status: "draft" },
                  after_snapshot: { title: "Selected edit", description: null, category: null, status: "draft" }
                }]
        },
        products: {
          findMany: async () => [{
            id: PRODUCT_ID,
            title: "Newer excluded edit",
            description: null,
            category: null,
            status: "draft",
            bridge_binding: null
          }],
          update: async () => assert.fail("a conflicting rollback must not write")
        }
      })
    });

    await assert.rejects(
      () => service.bulkUndo({
        mode: "last",
        count: 100,
        operator: "and",
        operationId: "00000000-0000-4000-8000-000000000004",
        changeIds: ["00000000-0000-4000-8000-000000000003"]
      }, ACTOR_ID),
      /newer excluded change/
    );
  });

  it("rejects reuse of a bulk operation ID for a different frozen selection", async () => {
    const service = serviceWith({
      $transaction: async (callback: (tx: unknown) => unknown) => callback({
        product_change_events: {
          findMany: async () => [{
            actor_user_id: ACTOR_ID,
            product_id: PRODUCT_ID,
            restored_from_event_id: "00000000-0000-4000-8000-000000000003"
          }]
        }
      })
    });

    await assert.rejects(
      () => service.bulkUndo({
        mode: "last",
        count: 100,
        operator: "and",
        operationId: "00000000-0000-4000-8000-000000000004",
        changeIds: ["00000000-0000-4000-8000-000000000005"]
      }, ACTOR_ID),
      /already in use/
    );
  });

  it("rejects an empty patch", async () => {
    const service = serviceWith({ products: { update: async () => assert.fail() } });
    await assert.rejects(
      () => service.updateAdminProduct(PRODUCT_ID, ACTOR_ID, {}),
      BadRequestException
    );
  });

  it("paginates seller listings in the admin product workspace", async () => {
    const listingOne = "00000000-0000-4000-8000-000000000010";
    const listingTwo = "00000000-0000-4000-8000-000000000011";
    let listingQuery: { take?: number } | undefined;
    const productRecord = {
      id: PRODUCT_ID,
      title: "Catalog product",
      slug: "catalog-product",
      description: null,
      category: "Tools",
      kind: "simple",
      type: "service",
      status: "active",
      created_at: new Date("2026-09-01T08:00:00.000Z"),
      updated_at: new Date("2026-09-09T08:00:00.000Z"),
      _count: { listings: 2 },
      created_by: { id: "00000000-0000-4000-8000-000000000012", shop_name: "Creator" },
      options: [],
      variants: []
    };
    const listing = (id: string) => ({
      id,
      status: "active",
      created_at: new Date("2026-09-02T08:00:00.000Z"),
      updated_at: new Date("2026-09-02T08:00:00.000Z"),
      seller: { id: "00000000-0000-4000-8000-000000000013", shop_name: "Seller" },
      offers: []
    });
    const service = serviceWith({
      products: { findUnique: async () => productRecord },
      seller_listings: {
        findMany: async (input: { take: number }) => {
          listingQuery = input;
          return [listing(listingOne), listing(listingTwo)];
        }
      }
    });

    const result = await service.getAdminProduct(PRODUCT_ID, { limit: 1 });

    assert.equal(listingQuery?.take, 2);
    assert.equal(result.listings.length, 1);
    assert.equal(result.nextListingCursor, listingOne);
    assert.equal(result.createdBy.shopName, "Creator");
  });
});
