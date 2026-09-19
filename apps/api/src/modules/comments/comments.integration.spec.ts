import { strict as assert } from "node:assert";
import { after, before, it } from "node:test";
import { randomUUID } from "node:crypto";
import type { AppUser } from "@topgsm/shared-types";
import { PrismaService } from "../../prisma/prisma.service";
import { assertDedicatedTestDatabase } from "../../test/test-database";
import { CommentsService } from "./comments.service";

assertDedicatedTestDatabase();
const prisma = new PrismaService();
const comments = new CommentsService(prisma);
const suffix = randomUUID();
let buyer: AppUser;
let admin: AppUser;
let sellerOne: AppUser;
let sellerTwo: AppUser;
let productId: string;
const sellerIds: string[] = [];

before(async () => {
  await prisma.$connect();
  const actors = await Promise.all([
    prisma.users.create({ data: { full_name: "Comment buyer", email: `comment-buyer-${suffix}@example.com`, role: "buyer" } }),
    prisma.users.create({ data: { full_name: "Comment admin", email: `comment-admin-${suffix}@example.com`, role: "platform_admin" } }),
    prisma.users.create({ data: { full_name: "Comment seller one", email: `comment-seller-1-${suffix}@example.com`, role: "seller_admin" } }),
    prisma.users.create({ data: { full_name: "Comment seller two", email: `comment-seller-2-${suffix}@example.com`, role: "seller_admin" } })
  ]);
  buyer = { id: actors[0].id, fullName: actors[0].full_name, email: actors[0].email, role: "buyer" };
  admin = { id: actors[1].id, fullName: actors[1].full_name, email: actors[1].email, role: "platform-admin" };
  sellerOne = { id: actors[2].id, fullName: actors[2].full_name, email: actors[2].email, role: "seller-admin" };
  sellerTwo = { id: actors[3].id, fullName: actors[3].full_name, email: actors[3].email, role: "seller-admin" };
  for (const actor of [sellerOne, sellerTwo]) {
    const seller = await prisma.sellers.create({ data: { user_id: actor.id, shop_name: `Shop ${actor.id}`, approved: true } });
    sellerIds.push(seller.id);
    await prisma.seller_memberships.create({ data: { seller_id: seller.id, user_id: actor.id, role: "admin" } });
  }
  const product = await prisma.products.create({ data: { created_by_seller_id: sellerIds[0], title: "Comment test product", slug: `comment-test-${suffix}`, type: "digital", status: "active" } });
  productId = product.id;
  const variant = await prisma.product_variants.create({ data: { product_id: productId, option_signature: "0".repeat(64) } });
  for (const sellerId of sellerIds) {
    const listing = await prisma.seller_listings.create({ data: { seller_id: sellerId, product_id: productId, status: "active" } });
    await prisma.seller_offers.create({ data: { listing_id: listing.id, variant_id: variant.id, price: "10", currency: "USD", status: "active", digital: { create: { file_reference: "https://example.com/download" } } } });
  }
});

after(async () => {
  await prisma.product_comment_events.deleteMany({ where: { comment: { product_id: productId } } });
  await prisma.product_comment_events.deleteMany({ where: { actor_user_id: admin.id, comment_id: null } });
  await prisma.product_comment_assignments.deleteMany({ where: { comment: { product_id: productId } } });
  await prisma.product_comments.deleteMany({ where: { product_id: productId } });
  await prisma.product_comment_settings.deleteMany({ where: { id: 1 } });
  await prisma.seller_offers.deleteMany({ where: { listing: { product_id: productId } } });
  await prisma.seller_listings.deleteMany({ where: { product_id: productId } });
  await prisma.product_variants.deleteMany({ where: { product_id: productId } });
  await prisma.products.deleteMany({ where: { id: productId } });
  await prisma.seller_memberships.deleteMany({ where: { seller_id: { in: sellerIds } } });
  await prisma.sellers.deleteMany({ where: { id: { in: sellerIds } } });
  await prisma.users.deleteMany({ where: { id: { in: [buyer.id, admin.id, sellerOne.id, sellerTwo.id] } } });
  await prisma.$disconnect();
});

it("locks each assigned seller independently and pauses both on spam review", async () => {
  await comments.updateSettings({ sellerLockEnabled: true, postingPolicy: "buyers", publicationPolicy: "immediate" }, admin.id);
  const created = await comments.create(productId, { body: "Can I use this abroad?" }, buyer);
  assert.equal(created.status, "approved");
  assert.equal(await prisma.product_comment_assignments.count({ where: { comment_id: created.id } }), 2);
  assert.equal((await comments.lockStatus(sellerOne)).locked, true);
  assert.equal((await comments.lockStatus(sellerTwo)).locked, true);

  const answers = await Promise.allSettled([
    comments.reply(sellerOne, created.id, "Yes"),
    comments.reply(sellerOne, created.id, "Also yes")
  ]);
  assert.equal(answers.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal((await comments.lockStatus(sellerOne)).locked, false);
  assert.equal((await comments.lockStatus(sellerTwo)).locked, true);

  await comments.flag(sellerTwo, created.id);
  assert.equal((await comments.lockStatus(sellerTwo)).locked, false);
  assert.equal((await comments.listPublic(productId, { limit: 20 })).items.length, 0);
  await comments.moderate(created.id, "restore", admin.id);
  assert.equal((await comments.lockStatus(sellerTwo)).locked, true);
  await comments.moderate(created.id, "reject", admin.id);
  assert.equal((await comments.lockStatus(sellerTwo)).locked, false);
});
