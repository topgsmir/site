import { strict as assert } from "node:assert";
import { after, before, describe, it } from "node:test";
import { ForbiddenException, NotFoundException } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { BlogActor } from "./blog-manage.guard";
import { BlogService } from "./blog.service";
import { PrismaService } from "../../prisma/prisma.service";
import { assertDedicatedTestDatabase } from "../../test/test-database";

assertDedicatedTestDatabase();
const prisma = new PrismaService();
const blog = new BlogService(prisma);
const suffix = randomUUID().slice(0, 8);
let sellerId: string;
let otherSellerId: string;
let sellerUserId: string;
let adminUserId: string;
let productId: string;
let categoryId: string;
let mediaId: string;
let postId: string;

const content = (text: string) => ({
  type: "doc",
  content: [{ type: "paragraph", content: [{ type: "text", text }] }]
});

function translations(version: string) {
  return (["fa", "en", "ar"] as const).map((locale) => ({
    locale,
    title: `${locale} repair guide ${version}`,
    slug: `${locale}-repair-guide-${suffix}-${version}`,
    excerpt: `${locale} complete repair excerpt ${version}`,
    seoTitle: `${locale} repair guide ${version}`,
    seoDescription: `${locale} complete search description for repair guide ${version}`,
    coverAltText: `${locale} technician repairing a phone`,
    content: content(`${locale} safe repair instructions ${version}`)
  }));
}

let sellerActor: BlogActor;
let otherSellerActor: BlogActor;
let adminActor: BlogActor;

before(async () => {
  await prisma.$connect();
  const created = await prisma.$transaction(async (tx) => {
    const sellerUser = await tx.users.create({ data: { full_name: "Blog Seller", email: `blog-seller-${suffix}@example.com`, role: "seller_admin" } });
    const otherUser = await tx.users.create({ data: { full_name: "Other Seller", email: `blog-other-${suffix}@example.com`, role: "seller_admin" } });
    const admin = await tx.users.create({ data: { full_name: "Blog Admin", email: `blog-admin-${suffix}@example.com`, role: "platform_admin" } });
    const seller = await tx.sellers.create({ data: { user_id: sellerUser.id, shop_name: "Repair Lab", approved: true, permissions: { create: { permission: "blog_manage" } } } });
    const other = await tx.sellers.create({ data: { user_id: otherUser.id, shop_name: "Other Lab", approved: true, permissions: { create: { permission: "blog_manage" } } } });
    const product = await tx.products.create({ data: { created_by_seller_id: seller.id, title: "Screen kit", slug: `screen-kit-${suffix}`, kind: "simple", type: "physical", status: "active" } });
    const variant = await tx.product_variants.create({ data: { product_id: product.id, option_signature: "a".repeat(64) } });
    const listing = await tx.seller_listings.create({ data: { seller_id: seller.id, product_id: product.id, status: "active" } });
    await tx.seller_offers.create({ data: { listing_id: listing.id, variant_id: variant.id, price: "100", currency: "TOMAN", status: "active", physical: { create: { stock: 10 } } } });
    const category = await tx.blog_categories.create({ data: { translations: { create: (["fa", "en", "ar"] as const).map((locale) => ({ locale, name: `${locale} Repair`, slug: `${locale}-repair-${suffix}` })) } } });
    const media = await tx.blog_media_assets.create({ data: { owner_user_id: sellerUser.id, seller_id: seller.id, kind: "cover", width: 1600, height: 900, byte_size: 1000, checksum: "a".repeat(64), variants: { create: { variant: "wide", width: 1600, height: 900, byte_size: 900, path: `test/${suffix}/wide.webp` } } } });
    return { sellerUser, otherUser, admin, seller, other, product, category, media };
  });
  sellerId = created.seller.id; otherSellerId = created.other.id; sellerUserId = created.sellerUser.id; adminUserId = created.admin.id; productId = created.product.id; categoryId = created.category.id; mediaId = created.media.id;
  sellerActor = { type: "seller", sellerId, reviewRequired: true, user: { id: sellerUserId, fullName: "Blog Seller", email: `blog-seller-${suffix}@example.com`, role: "seller-admin", permissions: ["blog_manage"] } };
  otherSellerActor = { type: "seller", sellerId: otherSellerId, reviewRequired: true, user: { id: created.otherUser.id, fullName: "Other", email: `blog-other-${suffix}@example.com`, role: "seller-admin", permissions: ["blog_manage"] } };
  adminActor = { type: "platform", user: { id: adminUserId, fullName: "Blog Admin", email: `blog-admin-${suffix}@example.com`, role: "platform-admin", isPlatformOwner: true } };
});

after(async () => {
  if (postId) {
    await prisma.blog_change_events.deleteMany({ where: { post_id: postId } });
    await prisma.blog_posts.deleteMany({ where: { id: postId } });
  }
  await prisma.blog_media_assets.deleteMany({ where: { id: mediaId } });
  await prisma.blog_categories.deleteMany({ where: { id: categoryId } });
  await prisma.seller_listings.deleteMany({ where: { product_id: productId } });
  await prisma.products.deleteMany({ where: { id: productId } });
  await prisma.sellers.deleteMany({ where: { id: { in: [sellerId, otherSellerId] } } });
  await prisma.users.deleteMany({ where: { email: { endsWith: `${suffix}@example.com` } } });
  await prisma.$disconnect();
});

describe("immutable multilingual blog workflow", () => {
  it("keeps the public revision live until the next revision is approved", async () => {
    const draft = await blog.create(sellerActor, {});
    postId = draft.id;
    const saved = await blog.update(sellerActor, postId, {
      optimisticVersion: draft.optimisticVersion,
      translations: translations("v1"),
      coverAssetId: mediaId,
      categoryId,
      tagIds: [],
      relatedProductIds: [productId]
    });
    assert.equal(saved.relatedProducts.length, 1);
    assert.equal(await prisma.blog_revision_media.count({ where: {
      asset_id: mediaId,
      usage: "cover",
      revision: { post_id: postId, revision_number: saved.revision }
    } }), 1);
    assert.equal((await blog.submit(sellerActor, postId)).state, "pending_review");
    await assert.rejects(() => blog.getPublic("en", `en-repair-guide-${suffix}-v1`), NotFoundException);

    const published = await blog.publish(adminActor, postId);
    assert.equal(published.state, "published");
    const publicV1 = await blog.getPublic("en", `en-repair-guide-${suffix}-v1`);
    assert.ok("title" in publicV1 && String(publicV1.title).includes("v1"));
    assert.ok("relatedProducts" in publicV1 && publicV1.relatedProducts.some((product) => product.id === productId));
    await prisma.products.update({ where: { id: productId }, data: { title: "Unapproved screen kit", status: "pending_review" } });
    const whilePrivate = await blog.getPublic("en", `en-repair-guide-${suffix}-v1`);
    assert.ok("relatedProducts" in whilePrivate && !whilePrivate.relatedProducts.some((product) => product.id === productId));
    await prisma.products.update({ where: { id: productId }, data: { title: "Screen kit", status: "active" } });

    const revision2 = await blog.update(sellerActor, postId, {
      optimisticVersion: published.optimisticVersion,
      translations: translations("v2"),
      coverAssetId: mediaId,
      categoryId,
      tagIds: [],
      relatedProductIds: [productId]
    });
    assert.equal(revision2.revision, 2);
    assert.equal((await blog.getPublic("en", `en-repair-guide-${suffix}-v1`) as { title: string }).title.includes("v1"), true);
    assert.equal((await blog.submit(sellerActor, postId)).state, "pending_review");
    const rejected = await blog.reject(adminActor, postId, "Add a clearer repair warning");
    assert.equal(rejected.state, "rejected");
    assert.equal(rejected.moderationNote, "Add a clearer repair warning");
  });

  it("prevents cross-seller management reads", async () => {
    await assert.rejects(() => blog.getManaged(otherSellerActor, postId), NotFoundException);
  });

  it("publishes both same-seller revisions when they reuse one image", async () => {
    const sharedMedia = await prisma.blog_media_assets.create({ data: {
      owner_user_id: sellerUserId, seller_id: sellerId, kind: "cover",
      width: 1600, height: 900, byte_size: 1000, checksum: "c".repeat(64)
    } });
    const posts: string[] = [];
    try {
      for (const version of ["reuse-a", "reuse-b"]) {
        const draft = await blog.create(sellerActor, {});
        posts.push(draft.id);
        await blog.update(sellerActor, draft.id, {
          optimisticVersion: draft.optimisticVersion, translations: translations(version),
          coverAssetId: sharedMedia.id, categoryId, tagIds: [], relatedProductIds: []
        });
      }
      assert.equal((await prisma.blog_media_assets.findUniqueOrThrow({ where: { id: sharedMedia.id } })).post_id, posts[1]);
      for (const currentPostId of posts) {
        assert.equal((await blog.publish(adminActor, currentPostId)).state, "published");
        assert.equal(await prisma.blog_revision_media.count({ where: { asset_id: sharedMedia.id, revision: { post_id: currentPostId } } }), 1);
      }
    } finally {
      await prisma.blog_change_events.deleteMany({ where: { post_id: { in: posts } } });
      await prisma.blog_posts.deleteMany({ where: { id: { in: posts } } });
      await prisma.blog_media_assets.delete({ where: { id: sharedMedia.id } });
    }
  });

  it("blocks a historical uploader from attaching or publishing the former seller's private media", async () => {
    const movedActor: BlogActor = { type: "seller", sellerId: otherSellerId, reviewRequired: false, user: sellerActor.user };
    const privateMedia = await prisma.blog_media_assets.create({ data: {
      owner_user_id: sellerUserId, seller_id: sellerId, post_id: postId, kind: "cover",
      width: 1600, height: 900, byte_size: 1000, checksum: "b".repeat(64)
    } });
    const draft = await blog.create(movedActor, {});
    try {
      const input = { optimisticVersion: draft.optimisticVersion, translations: translations("moved"),
        categoryId, tagIds: [], relatedProductIds: [] };
      await assert.rejects(blog.update(movedActor, draft.id, { ...input, coverAssetId: privateMedia.id }), ForbiddenException);
      assert.equal((await prisma.blog_media_assets.findUniqueOrThrow({ where: { id: privateMedia.id } })).post_id, postId);

      await blog.update(movedActor, draft.id, input);
      const stored = await prisma.blog_posts.findUniqueOrThrow({ where: { id: draft.id } });
      // Reproduce a persisted reference created before the attachment fix.
      await prisma.blog_revisions.update({ where: { id: stored.working_revision_id! }, data: { cover_asset_id: privateMedia.id } });
      await prisma.blog_media_assets.update({ where: { id: privateMedia.id }, data: { post_id: draft.id } });
      for (const actor of [movedActor, adminActor]) {
        await assert.rejects(blog.publish(actor, draft.id), ForbiddenException);
        assert.equal((await prisma.blog_media_assets.findUniqueOrThrow({ where: { id: privateMedia.id } })).published_at, null);
        assert.equal((await prisma.blog_posts.findUniqueOrThrow({ where: { id: draft.id } })).published_revision_id, null);
        assert.equal(await prisma.blog_routes.count({ where: { post_id: draft.id } }), 0);
      }
    } finally {
      await prisma.blog_change_events.deleteMany({ where: { post_id: draft.id } });
      await prisma.blog_posts.delete({ where: { id: draft.id } });
      await prisma.blog_media_assets.delete({ where: { id: privateMedia.id } });
    }
  });

  it("allows configured direct publishing and preserves permanent slug redirects", async () => {
    assert.equal(sellerActor.type, "seller");
    const directActor: BlogActor = {
      type: "seller",
      sellerId,
      reviewRequired: false,
      user: sellerActor.user
    };
    const current = await blog.getManaged(directActor, postId);
    await blog.update(directActor, postId, {
      optimisticVersion: current.optimisticVersion,
      translations: translations("v3"),
      coverAssetId: mediaId,
      categoryId,
      tagIds: [],
      relatedProductIds: [productId]
    });
    assert.equal((await blog.submit(directActor, postId)).state, "published");
    const oldRoute = await blog.getPublic("en", `en-repair-guide-${suffix}-v1`);
    assert.deepEqual(oldRoute, {
      redirectTo: `en-repair-guide-${suffix}-v3`,
      permanent: true
    });
    const currentRoute = await blog.getPublic("en", `en-repair-guide-${suffix}-v3`);
    assert.ok("title" in currentRoute && String(currentRoute.title).includes("v3"));
  });

  it("validates public collection identities and hides archived or suspended content", async () => {
    const categoryPage = await blog.listPublicTaxonomy("category", "en", `en-repair-${suffix}`, { limit: 20 });
    assert.equal(categoryPage.collection.name, "en Repair");
    assert.equal(categoryPage.items.length, 1);
    const sellerPage = await blog.listPublicSeller("en", sellerId, { limit: 20 });
    assert.equal(sellerPage.collection.name, "Repair Lab");
    await assert.rejects(
      () => blog.listPublicTaxonomy("tag", "en", "missing-tag", { limit: 20 }),
      NotFoundException
    );

    await prisma.sellers.update({ where: { id: sellerId }, data: { suspended_at: new Date() } });
    await assert.rejects(() => blog.getPublic("en", `en-repair-guide-${suffix}-v3`), NotFoundException);
    await assert.rejects(() => blog.listPublicSeller("en", sellerId, { limit: 20 }), NotFoundException);
    await prisma.sellers.update({ where: { id: sellerId }, data: { suspended_at: null } });

    await blog.archive(sellerActor, postId, true);
    await assert.rejects(() => blog.getPublic("en", `en-repair-guide-${suffix}-v3`), NotFoundException);
    await blog.archive(sellerActor, postId, false);
  });
});
