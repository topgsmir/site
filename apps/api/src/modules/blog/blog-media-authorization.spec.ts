import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { BadRequestException, ConflictException, ForbiddenException } from "@nestjs/common";
import type { PrismaService } from "../../prisma/prisma.service";
import type { BlogActor } from "./blog-manage.guard";
import { BlogService } from "./blog.service";

const id = (value: number) => `00000000-0000-4000-8000-${value.toString().padStart(12, "0")}`;
const sellerId = id(1);
const postId = id(2);
const ownerId = id(3);
const coverId = id(4);
const inlineId = id(5);
const seller: BlogActor = { type: "seller", sellerId, reviewRequired: false, user: {
  id: ownerId, fullName: "Editor", email: "editor@example.test", role: "seller-staff"
} };
const platform: BlogActor = { type: "platform", user: {
  id: id(6), fullName: "Moderator", email: "moderator@example.test", role: "platform-admin"
} };
type Asset = { id: string; owner_user_id: string; seller_id: string | null; post_id: string | null; kind: string; trashed_at: Date | null; published_at: Date | null };
const asset = (changes: Partial<Asset> = {}): Asset => ({
  id: coverId, owner_user_id: ownerId, seller_id: sellerId, post_id: postId,
  kind: "cover", trashed_at: null, published_at: null, ...changes
});

// Minimal data-store filter, so the public service methods exercise authorization
// against actual fixture rows rather than stubbing the authorization result.
function matches(row: Asset, where: Record<string, unknown>): boolean {
  return Object.entries(where).every(([key, value]) => {
    if (key === "OR") return (value as Record<string, unknown>[]).some((condition) => matches(row, condition));
    const actual = row[key as keyof Asset];
    if (value && typeof value === "object") {
      const filter = value as { in?: unknown[]; not?: unknown };
      if (filter.in) return filter.in.includes(actual);
      if ("not" in filter) return actual !== filter.not;
    }
    return actual === value;
  });
}

function fixture(assets: Asset[], options: { inline?: boolean; changeBeforeWrite?: boolean } = {}) {
  const writes: string[] = [];
  let transactionReads = 0;
  const translations = (["fa", "en", "ar"] as const).map((locale) => ({
    locale, title: "Article", slug: `article-${locale}`, excerpt: "Summary", seoTitle: "Article",
    seoDescription: "Description", coverAltText: "Cover", content: { type: "doc", content: [
      { type: "paragraph", content: [{ type: "text", text: "Article body" }] },
      ...(options.inline ? [{ type: "image", attrs: { src: `/media/${inlineId}/md.webp` } }] : [])
    ] }
  }));
  const revision = {
    id: id(7), status: "draft", revision_number: 1, optimistic_version: 1,
    cover_asset_id: coverId, category_id: id(8), cover_asset: null, category: null,
    tags: [], related_products: [], moderation_note: null,
    translations: translations.map((entry) => ({ ...entry, slug_proposal: entry.slug,
      seo_title: entry.seoTitle, seo_description: entry.seoDescription,
      cover_alt_text: entry.coverAltText, content_json: entry.content }))
  };
  const post = { id: postId, seller_id: sellerId, seller: null, routes: [], working_revision: revision,
    archived_at: null, published_at: null, updated_at: new Date() };
  const write = (name: string) => async () => { writes.push(name); return { count: 1 }; };
  const tx = {
    blog_posts: { findFirst: async () => post, update: write("post") },
    blog_revisions: { updateMany: write("revision"), update: write("revision") },
    blog_revision_translations: { deleteMany: write("translations"), createMany: write("translations") },
    blog_revision_media: { deleteMany: write("references"), createMany: write("references") },
    blog_revision_tags: { deleteMany: write("tags") },
    blog_revision_products: { deleteMany: write("products") },
    blog_change_events: { create: write("change") },
    blog_moderation_events: { create: write("moderation") },
    blog_routes: { findUnique: async () => null, updateMany: write("route"), create: write("route") },
    blog_media_assets: {
      findMany: async ({ where }: { where: Record<string, unknown> }) => {
        transactionReads += 1;
        return assets.filter((row) => matches(row, where));
      },
      updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Partial<Asset> }) => {
        if (options.changeBeforeWrite) assets[0]!.seller_id = id(99);
        const rows = assets.filter((row) => matches(row, where));
        for (const row of rows) Object.assign(row, data);
        writes.push("media");
        return { count: rows.length };
      }
    }
  };
  const prisma = {
    blog_posts: tx.blog_posts,
    blog_categories: { count: async () => 1 },
    blog_media_assets: { findMany: async () => { throw new Error("Media authorization must run in the transaction"); } },
    $transaction: async (callback: (client: unknown) => Promise<unknown>) => callback(tx)
  } as unknown as PrismaService;
  return { service: new BlogService(prisma), writes, assets, reads: () => transactionReads,
    input: { optimisticVersion: 1, translations, coverAssetId: coverId, categoryId: id(8), tagIds: [], relatedProductIds: [] } };
}

describe("blog media seller isolation", () => {
  it("rejects a historical uploader attaching seller A's image after moving to seller B", async () => {
    const test = fixture([asset({ seller_id: id(99), post_id: id(98) })]);
    await assert.rejects(test.service.update(seller, postId, test.input), ForbiddenException);
    assert.deepEqual(test.writes, []);
    assert.equal(test.assets[0]!.post_id, id(98));
  });

  it("allows same-seller uploader attachment and legitimate platform editing of attached media", async () => {
    for (const actor of [seller, platform]) {
      const test = fixture([asset()]);
      await test.service.update(actor, postId, test.input);
      assert.ok(test.writes.includes("media"));
      assert.equal(test.reads(), 1);
    }
  });

  it("rejects tainted persisted cover and inline references even during platform moderation", async () => {
    for (const actor of [seller, platform]) {
      for (const inline of [false, true]) {
        const foreign = asset({ id: inline ? inlineId : coverId, kind: inline ? "inline" : "cover", seller_id: id(99) });
        const test = fixture(inline ? [asset(), foreign] : [foreign], { inline });
        await assert.rejects(test.service.publish(actor, postId), ForbiddenException);
        assert.deepEqual(test.writes, []);
        assert.equal(foreign.published_at, null);
      }
    }
  });

  it("allows same-seller publication by a different uploader and platform moderation", async () => {
    for (const actor of [seller, platform]) {
      const test = fixture([asset({ owner_user_id: id(90) })]);
      await test.service.publish(actor, postId);
      assert.ok(test.assets[0]!.published_at instanceof Date);
      assert.equal(test.reads(), 1);
    }
  });

  it("requires platform moderation for unpublished platform media and permits later seller republication", async () => {
    const test = fixture([asset({ seller_id: null, owner_user_id: platform.user.id })]);
    await assert.rejects(test.service.publish(seller, postId), ForbiddenException);
    await test.service.publish(platform, postId);
    await test.service.publish(seller, postId);
    assert.ok(test.assets[0]!.published_at instanceof Date);
  });

  it("allows a same-seller revision to reuse media most recently attached to another post", async () => {
    for (const actor of [seller, platform]) {
      const test = fixture([asset({ post_id: id(90) })]);
      await test.service.publish(actor, postId);
      assert.ok(test.assets[0]!.published_at instanceof Date);
    }
  });

  it("rejects trashed, missing, foreign platform and incorrect cover assets before publication writes", async () => {
    for (const assets of [[], [asset({ trashed_at: new Date() })], [asset({ seller_id: null, post_id: id(90), published_at: new Date() })]]) {
      const test = fixture(assets);
      await assert.rejects(test.service.publish(platform, postId), ForbiddenException);
      assert.deepEqual(test.writes, []);
    }
    const test = fixture([asset({ kind: "inline" })]);
    await assert.rejects(test.service.publish(platform, postId), BadRequestException);
    assert.deepEqual(test.writes, []);
  });

  it("rechecks media scope in the final attachment and publication writes", async () => {
    const update = fixture([asset()], { changeBeforeWrite: true });
    await assert.rejects(update.service.update(seller, postId, update.input), ConflictException);
    const publication = fixture([asset()], { changeBeforeWrite: true });
    await assert.rejects(publication.service.publish(platform, postId), ConflictException);
    assert.equal(publication.assets[0]!.published_at, null);
  });
});
