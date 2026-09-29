import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { BadRequestException, ForbiddenException } from "@nestjs/common";
import type { PrismaService } from "../../prisma/prisma.service";
import type { BlogActor } from "./blog-manage.guard";
import { BlogService } from "./blog.service";
import { validateRichText } from "./rich-text.validator";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { ManagedBlogQueryDto, ReorderTaxonomyDto, TaxonomyDto } from "./dto/blog-post.dto";

describe("blog taxonomy management", () => {
  it("rejects duplicate and invalid reorder IDs and overlong metadata", async () => {
    const id = "00000000-0000-4000-8000-000000000003";
    assert.ok((await validate(plainToInstance(ReorderTaxonomyDto, { ids: [id, id] }))).length > 0);
    assert.ok((await validate(plainToInstance(ReorderTaxonomyDto, { ids: ["invalid"] }))).length > 0);
    const translations = (["fa", "en", "ar"] as const).map((locale) => ({ locale, name: "Guide", slug: `guide-${locale}`, metaDescription: "x".repeat(321) }));
    assert.ok((await validate(plainToInstance(TaxonomyDto, { translations }))).length > 0);
    const service = new BlogService({} as PrismaService);
    const oversizedTag = (["fa", "en", "ar"] as const).map((locale) => ({ locale, name: "x".repeat(81), slug: `tag-${locale}` }));
    await assert.rejects(service.createTaxonomy("tag", { translations: oversizedTag }), BadRequestException);
  });

  it("reorders only when the supplied IDs exactly match current terms", async () => {
    const first = "00000000-0000-4000-8000-000000000003";
    const second = "00000000-0000-4000-8000-000000000004";
    const updates: Array<{ id: string; position: number }> = [];
    const prisma = {
      $transaction: async (callback: (tx: unknown) => Promise<void>) => callback(prisma),
      blog_categories: {
        findMany: async (query?: { select?: { id?: boolean } }) => query?.select ? [{ id: first }, { id: second }] : [],
        update: async ({ where, data }: { where: { id: string }; data: { position: number } }) => { updates.push({ id: where.id, position: data.position }); }
      },
      blog_tags: { findMany: async () => [] }
    } as unknown as PrismaService;
    const service = new BlogService(prisma);
    await assert.rejects(service.reorderTaxonomy("category", [first]), /Taxonomy changed/);
    assert.deepEqual(updates, []);
    await service.reorderTaxonomy("category", [second, first]);
    assert.deepEqual(updates, [{ id: second, position: 0 }, { id: first, position: 1 }]);
  });
});

const sellerActor: BlogActor = {
  type: "seller",
  sellerId: "00000000-0000-4000-8000-000000000001",
  reviewRequired: true,
  user: {
    id: "00000000-0000-4000-8000-000000000002",
    fullName: "Seller",
    email: "seller@example.com",
    role: "seller-admin",
    permissions: ["blog_manage"]
  }
};

describe("multilingual blog security", () => {
  it("validates managed search bounds and filter allowlists", async () => {
    for (const query of [{ search: "x".repeat(101) }, { status: "deleted" }, { categoryId: "invalid" }, { limit: 51 }]) {
      assert.ok((await validate(plainToInstance(ManagedBlogQueryDto, query))).length > 0);
    }
    assert.equal((await validate(plainToInstance(ManagedBlogQueryDto, { search: "راهنما", status: "published", limit: "20" }))).length, 0);
  });

  it("combines multilingual search and category/status filters with seller isolation and cursor pagination", async () => {
    let query: Record<string, unknown> = {};
    const prisma = { blog_posts: { findMany: async (input: Record<string, unknown>) => { query = input; return []; } } } as unknown as PrismaService;
    const service = new BlogService(prisma);
    const categoryId = "00000000-0000-4000-8000-000000000003";
    const cursor = "00000000-0000-4000-8000-000000000004";
    assert.deepEqual(await service.listManaged(sellerActor, { search: "  Guide  ", status: "published", categoryId, cursor, limit: 20 }), { items: [], nextCursor: null });
    assert.deepEqual(query.where, {
      seller_id: sellerActor.sellerId,
      archived_at: null,
      working_revision: { status: "published", category_id: categoryId, translations: { some: { OR: [
        { title: { contains: "Guide", mode: "insensitive" } },
        { slug: { contains: "Guide", mode: "insensitive" } },
        { excerpt: { contains: "Guide", mode: "insensitive" } }
      ] } } }
    });
    assert.equal(query.take, 21);
    assert.equal(query.skip, 1);
    assert.deepEqual(query.cursor, { id: cursor });
    await service.listManaged(sellerActor, { status: "archived", limit: 20 });
    assert.deepEqual(query.where, { seller_id: sellerActor.sellerId, archived_at: { not: null }, working_revision: {} });
  });

  it("rejects raw HTML nodes and unsafe link protocols", () => {
    assert.throws(
      () => validateRichText({ type: "doc", content: [{ type: "html", text: "<script />" }] }),
      BadRequestException
    );
    assert.throws(
      () => validateRichText({
        type: "doc",
        content: [{
          type: "paragraph",
          content: [{ type: "text", text: "open", marks: [{ type: "link", attrs: { href: "javascript:alert(1)" } }] }]
        }]
      }),
      BadRequestException
    );
    assert.throws(
      () => validateRichText({
        type: "doc",
        content: [{
          type: "paragraph",
          content: [{ type: "text", text: "email", marks: [{ type: "link", attrs: { href: "mailto:user%0a@example.com" } }] }]
        }]
      }),
      BadRequestException
    );
  });

  it("accepts allowlisted content and extracts same-origin media ids", () => {
    const result = validateRichText({
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "image", attrs: { src: "/media/00000000-0000-4000-8000-000000000003/md.webp" } }]
        },
        { type: "horizontalRule" }
      ]
    });
    assert.deepEqual(result.mediaIds, ["00000000-0000-4000-8000-000000000003"]);
    assert.deepEqual(result.content, {
      type: "doc",
      content: [
        {
          type: "paragraph",
          content: [{ type: "image", attrs: { src: "/media/00000000-0000-4000-8000-000000000003/md.webp" } }]
        },
        { type: "horizontalRule" }
      ]
    });
  });

  it("canonicalizes rich text and drops unrecognized attributes and properties", () => {
    const result = validateRichText({
      type: "doc",
      ignored: "not persisted",
      content: [{
        type: "paragraph",
        attrs: { onclick: "alert(1)" },
        content: [{ type: "text", text: "Safe", unknown: true, marks: [{ type: "bold", attrs: { style: "display:none" } }] }]
      }]
    });
    assert.deepEqual(result.content, {
      type: "doc",
      content: [{ type: "paragraph", content: [{ type: "text", text: "Safe", marks: [{ type: "bold" }] }] }]
    });
  });

  it("preserves safe article tables, alignment and image descriptions", () => {
    const result = validateRichText({ type: "doc", content: [
      { type: "paragraph", attrs: { textAlign: "center", onclick: "ignored" }, content: [{ type: "text", text: "Intro" }] },
      { type: "table", content: [{ type: "tableRow", content: [
        { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "Title" }] }] },
        { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "Value" }] }] }
      ] }] },
      { type: "image", attrs: { src: "/media/00000000-0000-4000-8000-000000000003/md.webp", alt: "Useful chart", onclick: "ignored" } }
    ] });
    assert.deepEqual(result.content, { type: "doc", content: [
      { type: "paragraph", attrs: { textAlign: "center" }, content: [{ type: "text", text: "Intro" }] },
      { type: "table", content: [{ type: "tableRow", content: [
        { type: "tableHeader", content: [{ type: "paragraph", content: [{ type: "text", text: "Title" }] }] },
        { type: "tableCell", content: [{ type: "paragraph", content: [{ type: "text", text: "Value" }] }] }
      ] }] },
      { type: "image", attrs: { src: "/media/00000000-0000-4000-8000-000000000003/md.webp", alt: "Useful chart" } }
    ] });
    assert.throws(() => validateRichText({ type: "doc", content: [{ type: "paragraph", attrs: { textAlign: "expression(alert(1))" } }] }), BadRequestException);
    assert.throws(() => validateRichText({ type: "doc", content: [{ type: "table", content: [{ type: "paragraph" }] }] }), BadRequestException);
    assert.throws(() => validateRichText({ type: "doc", content: [{ type: "tableRow", content: [{ type: "tableCell", content: [{ type: "paragraph" }] }] }] }), BadRequestException);
  });

  it("scopes seller product search to active listings", async () => {
    let where: unknown;
    const prisma = {
      products: {
        findMany: async (input: { where: unknown }) => {
          where = input.where;
          return [];
        }
      }
    } as unknown as PrismaService;
    const service = new BlogService(prisma);
    await service.productOptions(sellerActor, { limit: 20 });
    assert.deepEqual(where, {
      status: "active",
      listings: {
        some: {
          seller_id: sellerActor.sellerId,
          status: "active"
        }
      }
    });
  });

  it("public listings exclude archives and suspended sellers", async () => {
    let where: unknown;
    const prisma = {
      blog_posts: {
        findMany: async (input: { where: unknown }) => {
          where = input.where;
          return [];
        }
      }
    } as unknown as PrismaService;
    const service = new BlogService(prisma);
    await service.listPublic("fa", { limit: 20 });
    assert.deepEqual(where, {
      archived_at: null,
      published_revision_id: { not: null },
      OR: [
        { seller_id: null },
        { seller: { approved: true, invited: false, suspended_at: null } }
      ],
      published_revision: { translations: { some: { locale: "fa" } } }
    });
  });

  it("returns the current published slugs to management screens", async () => {
    let include: unknown;
    const prisma = {
      blog_posts: {
        findMany: async (input: { include: unknown }) => {
          include = input.include;
          return [{
            id: "00000000-0000-4000-8000-000000000010",
            archived_at: null,
            seller: null,
            routes: [
              { locale: "fa", slug: "راهنمای-خرید" },
              { locale: "en", slug: "buying-guide" }
            ],
            working_revision: {
              status: "draft",
              revision_number: 2,
              optimistic_version: 1,
              translations: [],
              cover_asset: null,
              category: null,
              tags: [],
              related_products: [],
              moderation_note: null
            },
            published_at: new Date("2026-09-07T08:00:00.000Z"),
            updated_at: new Date("2026-09-08T08:00:00.000Z")
          }];
        }
      }
    } as unknown as PrismaService;

    const service = new BlogService(prisma);
    const result = await service.listManaged(sellerActor, { limit: 20 });

    assert.deepEqual(
      (include as { routes: unknown }).routes,
      { where: { is_current: true }, select: { locale: true, slug: true } }
    );
    assert.deepEqual(result.items[0]?.publicSlugs, {
      fa: "راهنمای-خرید",
      en: "buying-guide"
    });
  });

  it("scopes blog change history to the seller-owned post", async () => {
    let where: unknown;
    const prisma = {
      blog_posts: {
        findFirst: async (input: { where: unknown }) => {
          where = input.where;
          return {
            id: "00000000-0000-4000-8000-000000000010",
            seller: null,
            routes: [],
            working_revision: {
              status: "draft",
              revision_number: 1,
              optimistic_version: 1,
              translations: [],
              cover_asset: null,
              category: null,
              tags: [],
              related_products: [],
              moderation_note: null
            },
            archived_at: null,
            published_at: null,
            updated_at: new Date()
          };
        }
      },
      blog_change_events: { findMany: async () => [] }
    } as unknown as PrismaService;

    await new BlogService(prisma).listChanges(
      sellerActor,
      "00000000-0000-4000-8000-000000000010",
      { limit: 20 }
    );
    assert.deepEqual(where, {
      id: "00000000-0000-4000-8000-000000000010",
      seller_id: sellerActor.sellerId
    });
  });

  it("does not let sellers restore blog history", async () => {
    await assert.rejects(
      () => new BlogService({} as PrismaService).restoreChange(
        sellerActor,
        "00000000-0000-4000-8000-000000000010",
        "00000000-0000-4000-8000-000000000011",
        1
      ),
      ForbiddenException
    );
  });

});
