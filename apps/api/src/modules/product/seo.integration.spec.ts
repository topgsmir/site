import "reflect-metadata";
import assert from "node:assert/strict";
import { before, after, describe, it } from "node:test";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { Client } from "pg";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { ValidationPipe, UnauthorizedException, type INestApplication } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { assertDedicatedTestDatabase } from "../../test/test-database";
import { ProductService } from "./product.service";
import { ProductTranslationsService } from "./product-translations.service";
import { ProductController } from "./product.controller";
import { AuthRateLimitService } from "../auth/auth-rate-limit.service";
import { RequestAuthenticationService } from "../auth/request-authentication.service";
import type { AuthenticatedRequest } from "../auth/platform-admin.guard";
import { MediaService } from "../media/media.service";
import { SeoService } from "../seo/seo.service";
import { BlogService } from "../blog/blog.service";
import type { BlogActor } from "../blog/blog-manage.guard";

assertDedicatedTestDatabase();
const prisma = new PrismaService();
const config = new ConfigService({ BRIDGE_FEATURE_ENABLED: "false" });
const products = new ProductService(prisma, config);
const translations = new ProductTranslationsService(prisma);
const seo = new SeoService(prisma, config);
const suffix = randomUUID().slice(0, 8);
let sellerId: string;
let adminId: string;
let sellerUserId: string;
let app: INestApplication;
let base: string;
const ids: string[] = [];
const postIds: string[] = [];
let categoryId: string;
let tagId: string;
let mediaId: string;

before(async () => {
  await prisma.$connect();
  const admin = await prisma.users.create({ data: { full_name: "SEO administrator", email: `seo-admin-${suffix}@example.com`, role: "platform_admin" } });
  const sellerUser = await prisma.users.create({ data: { full_name: "SEO seller", email: `seo-seller-${suffix}@example.com`, role: "seller_admin" } });
  adminId = admin.id; sellerUserId = sellerUser.id;
  const seller = await prisma.sellers.create({ data: { user_id: sellerUserId, shop_name: `SEO ${suffix}`, approved: true } });
  sellerId = seller.id;
  for (let i = 0; i < 51; i++) {
    const product = await prisma.$transaction(async (tx) => {
      const product = await tx.products.create({ data: { created_by_seller_id: sellerId, title: `محصول ${suffix} ${i}`, description: "توضیحات محصول", slug: `seo-${suffix}-${i}`, type: "physical", status: "active" } });
      const variant = await tx.product_variants.create({ data: { product_id: product.id, option_signature: "a".repeat(64) } });
      const listing = await tx.seller_listings.create({ data: { product_id: product.id, seller_id: sellerId, status: "active" } });
      await tx.seller_offers.create({ data: { listing_id: listing.id, variant_id: variant.id, price: "1000", currency: "TOMAN", status: "active", physical: { create: { stock: 10, weight_grams: 100 } } } });
      return product;
    });
    ids.push(product.id);
  }
  const locales = ["fa", "en", "ar"] as const;
  const category = await prisma.blog_categories.create({ data: { translations: { create: locales.map((locale) => ({ locale, name: "Repair", slug: `repair-${suffix}` })) } } });
  const tag = await prisma.blog_tags.create({ data: { translations: { create: locales.map((locale) => ({ locale, name: "Tools", slug: `tools-${suffix}` })) } } });
  const media = await prisma.blog_media_assets.create({ data: { owner_user_id: sellerUserId, seller_id: sellerId, kind: "cover", width: 1600, height: 900, byte_size: 1000, checksum: "a".repeat(64), variants: { create: { variant: "wide", width: 1600, height: 900, byte_size: 900, path: `seo/${suffix}/wide.webp` } } } });
  categoryId = category.id; tagId = tag.id; mediaId = media.id;
  const blog = new BlogService(prisma);
  const actor: BlogActor = { type: "seller", sellerId, reviewRequired: false, user: { id: sellerUserId, role: "seller-admin", fullName: "SEO seller", email: sellerUser.email, permissions: ["blog_manage"] } };
  for (let i = 0; i < 31; i++) {
    const post = await blog.create(actor, {}); postIds.push(post.id);
    await blog.update(actor, post.id, { optimisticVersion: post.optimisticVersion, categoryId, tagIds: [tagId], coverAssetId: mediaId, relatedProductIds: [], translations: locales.map((locale) => ({ locale, title: `Repair guide ${i}`, slug: `guide-${suffix}-${i}`, excerpt: "A repair guide", seoTitle: "Repair guide", seoDescription: "A complete repair guide", coverAltText: "Repair tools", content: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "Repair instructions" }] }] } })) });
    await blog.publish(actor, post.id);
  }
  const module = await Test.createTestingModule({ controllers: [ProductController], providers: [
    { provide: PrismaService, useValue: prisma }, { provide: ConfigService, useValue: config },
    { provide: ProductService, useValue: products }, { provide: ProductTranslationsService, useValue: translations },
    { provide: AuthRateLimitService, useValue: {} }, { provide: MediaService, useValue: {} },
    { provide: RequestAuthenticationService, useValue: { authenticate: async (request: AuthenticatedRequest) => {
      const identity = request.headers.authorization;
      if (!identity) throw new UnauthorizedException();
      const user = { id: identity === "admin" ? adminId : sellerUserId, role: identity === "admin" ? "platform-admin" : "seller-admin", fullName: "SEO test" };
      request.authenticatedUser = user as AuthenticatedRequest["authenticatedUser"];
      return user;
    } } }
  ] }).compile();
  app = module.createNestApplication({ logger: false });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
  await app.listen(0, "127.0.0.1");
  base = await app.getUrl();
});

after(async () => {
  if (app) await app.close();
  await prisma.blog_change_events.deleteMany({ where: { post_id: { in: postIds } } });
  await prisma.blog_posts.deleteMany({ where: { id: { in: postIds } } });
  if (mediaId) await prisma.blog_media_assets.delete({ where: { id: mediaId } });
  if (categoryId) await prisma.blog_categories.delete({ where: { id: categoryId } });
  if (tagId) await prisma.blog_tags.delete({ where: { id: tagId } });
  await prisma.product_change_events.deleteMany({ where: { product_id: { in: ids } } });
  await prisma.seller_listings.deleteMany({ where: { product_id: { in: ids } } });
  await prisma.products.deleteMany({ where: { id: { in: ids } } });
  if (sellerId) await prisma.sellers.delete({ where: { id: sellerId } });
  await prisma.users.deleteMany({ where: { id: { in: [adminId, sellerUserId].filter(Boolean) } } });
  await prisma.$disconnect();
});

describe("product SEO database and HTTP contracts", () => {
  it("paginates beyond 50 products, preserves the legacy array and rejects invalid cursors", async () => {
    const first = await products.listPublicPage({ search: suffix, limit: 50 });
    assert.equal(first.items.length, 50); assert.ok(first.nextCursor);
    const last = await products.listPublicPage({ search: suffix, limit: 50, cursor: first.nextCursor! });
    assert.equal(last.items.length, 1); assert.equal(last.nextCursor, null);
    assert.equal(new Set([...first.items, ...last.items].map((item) => item.id)).size, 51);
    assert.ok(Array.isArray(await products.listPublic({ limit: 50 })));
    assert.equal((await fetch(`${base}/products/page?cursor=invalid`)).status, 400);
    assert.equal((await fetch(`${base}/products/page?cursor=${randomUUID()}`)).status, 404);
    await assert.rejects(new BlogService(prisma).listPublic("fa", { limit: 30, cursor: randomUUID() }), /Page was not found/);
  });

  it("paginates all blog collections beyond 30 and excludes empty taxonomies from sitemaps", async () => {
    const blog = new BlogService(prisma);
    for (const read of [
      (cursor?: string) => blog.listPublic("fa", { limit: 30, cursor }),
      (cursor?: string) => blog.listPublicTaxonomy("category", "fa", `repair-${suffix}`, { limit: 30, cursor }),
      (cursor?: string) => blog.listPublicTaxonomy("tag", "fa", `tools-${suffix}`, { limit: 30, cursor }),
      (cursor?: string) => blog.listPublicSeller("fa", sellerId, { limit: 30, cursor })
    ]) {
      const first = await read(); assert.equal(first.items.length, 30); assert.ok(first.nextCursor);
      const last = await read(first.nextCursor!); assert.equal(last.items.length, 1); assert.equal(last.nextCursor, null);
      assert.equal(new Set([...first.items, ...last.items].map((row) => row.id)).size, 31);
    }
    const empty = await prisma.blog_categories.create({ data: { translations: { create: { locale: "fa", name: "Empty", slug: `empty-${suffix}` } } } });
    try { assert.ok(!(await seo.feed({ kind: "categories", locale: "fa" })).items.some((row) => row.id === empty.id)); }
    finally { await prisma.blog_categories.delete({ where: { id: empty.id } }); }
  });

  it("reserves old slugs through renames and restores, including competing writes", async () => {
    const original = `seo-${suffix}-0`;
    const second = `تعمیر-${suffix}`;
    await products.updateAdminProduct(ids[0]!, adminId, { slug: second });
    await products.updateAdminProduct(ids[0]!, adminId, { slug: `latest-${suffix}` });
    assert.equal((await products.getPublic(original)).slug, `latest-${suffix}`);
    assert.equal((await products.getPublic(second)).id, ids[0]);
    assert.equal((await products.getPublic(ids[0]!)).slug, `latest-${suffix}`);
    await products.updateAdminProduct(ids[0]!, adminId, { slug: original });
    assert.equal((await products.getPublic(second)).slug, original);
    const renamed = `undo-${suffix}`;
    await products.updateAdminProduct(ids[0]!, adminId, { slug: renamed });
    const change = await prisma.product_change_events.findFirstOrThrow({ where: { product_id: ids[0]! }, orderBy: [{ created_at: "desc" }, { id: "desc" }] });
    await products.restoreProductChange(ids[0]!, change.id, adminId, "before");
    assert.equal((await products.getPublic(renamed)).slug, original);
    await products.updateAdminProduct(ids[0]!, adminId, { slug: `bulk-${suffix}` });
    const bulkChange = await prisma.product_change_events.findFirstOrThrow({ where: { product_id: ids[0]! }, orderBy: [{ created_at: "desc" }, { id: "desc" }] });
    await products.bulkUndo({ mode: "last", count: 1, operator: "and", operationId: randomUUID(), changeIds: [bulkChange.id] }, adminId);
    assert.equal((await products.getPublic(`bulk-${suffix}`)).slug, original);
    await assert.rejects(products.updateAdminProduct(ids[1]!, adminId, { slug: second }));
    const target = `race-${suffix}`;
    const attempts = await Promise.allSettled([ids[2]!, ids[3]!].map((id) => products.updateAdminProduct(id, adminId, { slug: target })));
    assert.equal(attempts.filter((result) => result.status === "fulfilled").length, 1);
    await prisma.products.update({ where: { id: ids[0]! }, data: { status: "archived" } });
    await assert.rejects(products.getPublic(second), /not found/);
    await prisma.products.update({ where: { id: ids[0]! }, data: { status: "active" } });
  });

  it("keeps drafts private and publishes only complete administrator-approved translations", async () => {
    const url = `${base}/products/admin/${ids[0]}/translations/en`;
    const draft = { title: "Repair tool", description: "A complete translated description", category: "Tools" };
    const options = { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(draft) };
    assert.equal((await fetch(url, options)).status, 401);
    assert.equal((await fetch(url, { ...options, headers: { ...options.headers, authorization: "seller" } })).status, 403);
    assert.equal((await fetch(url, { ...options, headers: { ...options.headers, authorization: "admin" } })).status, 200);
    assert.equal((await products.getPublic(ids[0]!, "en")).contentLocale, "fa");
    await translations.change(ids[0]!, "en", adminId, "publish");
    const published = await products.getPublic(ids[0]!, "en");
    assert.equal(published.title, "Repair tool"); assert.equal(published.contentLocale, "en");
    assert.deepEqual(published.availableLocales, ["fa", "en"]);
    assert.equal((await products.listPublicPage({ locale: "en", search: "Repair tool", limit: 50 })).items.length, 1);
    await translations.change(ids[0]!, "en", adminId, "draft", { ...draft, title: "Unpublished revision" });
    assert.equal((await products.getPublic(ids[0]!, "en")).title, "Repair tool");
    assert.ok((await seo.feed({ kind: "products", locale: "en" })).items.some((row) => row.id === ids[0]));
    await translations.change(ids[0]!, "en", adminId, "unpublish");
    assert.equal((await products.getPublic(ids[0]!, "en")).contentLocale, "fa");
    assert.ok(!(await seo.feed({ kind: "products", locale: "en" })).items.some((row) => row.id === ids[0]));
    await translations.change(ids[0]!, "ar", adminId, "draft", { title: "", description: "" });
    await assert.rejects(translations.change(ids[0]!, "ar", adminId, "publish"), /required/);
    assert.equal((await fetch(url.replace("/en", "/fa"), { ...options, headers: { ...options.headers, authorization: "admin" } })).status, 400);
  });

  it("keeps sitemap counts and public visibility aligned", async () => {
    const manifest = await seo.manifest();
    assert.equal(manifest.feeds.length, 15);
    const feed = await seo.feed({ kind: "products", locale: "fa" });
    assert.equal(feed.items.length, manifest.feeds.find((item) => item.kind === "products" && item.locale === "fa")!.count);
    await prisma.sellers.update({ where: { id: sellerId }, data: { suspended_at: new Date() } });
    assert.equal((await products.listPublicPage({ search: suffix, limit: 50 })).items.length, 0);
    assert.ok(!(await seo.feed({ kind: "products", locale: "fa" })).items.some((item) => ids.includes(item.id)));
    await prisma.sellers.update({ where: { id: sellerId }, data: { suspended_at: null } });
  });

  it("backfills existing slugs and enforces publication constraints during migration", async () => {
    const client = new Client({ connectionString: process.env.DATABASE_URL });
    const schema = `seo_migration_test_${randomUUID().replaceAll("-", "")}`;
    await client.connect();
    try {
      await client.query(`CREATE SCHEMA ${schema}; SET search_path TO ${schema}; CREATE TYPE blog_locale AS ENUM ('fa', 'en', 'ar'); CREATE TABLE products (id text PRIMARY KEY, slug text UNIQUE NOT NULL); INSERT INTO products VALUES ('existing', 'original');`);
      await client.query(readFileSync("src/prisma/schema/migrations/20260922200000_product_seo/migration.sql", "utf8"));
      assert.equal((await client.query("SELECT product_id FROM product_slug_routes WHERE slug = 'original'")).rows[0].product_id, "existing");
      await client.query("UPDATE products SET slug = 'renamed' WHERE id = 'existing'");
      await assert.rejects(client.query("INSERT INTO products VALUES ('other', 'original')"), /reserved/);
      await assert.rejects(client.query("INSERT INTO product_translations(product_id, locale, published_at, updated_by) VALUES ('existing', 'en', NOW(), 'admin')"), /check constraint/);
    } finally {
      await client.query("ROLLBACK");
      await client.query(`DROP SCHEMA ${schema} CASCADE`);
      await client.end();
    }
  });
});
