import "reflect-metadata";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { randomUUID } from "node:crypto";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";
import { assertDedicatedTestDatabase } from "../../test/test-database";
import { ProductService } from "./product.service";
import { resolveProductCategory } from "./product-category";

assertDedicatedTestDatabase();
const prisma = new PrismaService();
const service = new ProductService(prisma, new ConfigService());
const suffix = randomUUID().slice(0, 8);
let actorId: string;
let sellerId: string;
let productId: string;
const categoryIds: string[] = [];

before(async () => {
  const actor = await prisma.users.create({ data: { full_name: "Category integration", email: `categories-${suffix}@example.test`, role: "platform_admin" } });
  actorId = actor.id;
  const seller = await prisma.sellers.create({ data: { user_id: actorId, shop_name: `Categories ${suffix}`, approved: true } });
  sellerId = seller.id;
});

after(async () => {
  if (actorId) await prisma.product_category_events.deleteMany({ where: { actor_user_id: actorId } });
  if (productId) await prisma.products.delete({ where: { id: productId } });
  for (const id of categoryIds.reverse()) await prisma.product_categories.deleteMany({ where: { id } });
  if (sellerId) await prisma.sellers.delete({ where: { id: sellerId } });
  if (actorId) await prisma.users.delete({ where: { id: actorId } });
  await prisma.$disconnect();
});

test("category hierarchy, metadata, image, and explicit product reassignment survive mutations", async () => {
  const legacyId = await prisma.$transaction((tx) => resolveProductCategory(tx, { category: `Legacy ${suffix}` }));
  categoryIds.push(legacyId!);
  assert.match((await prisma.product_categories.findUniqueOrThrow({ where: { id: legacyId! }, select: { slug: true } })).slug, /^category-[0-9a-f-]{36}$/);
  const root = await service.createCategory(actorId, { name: `Root ${suffix}`, slug: `root-${suffix}` });
  categoryIds.push(root.id);
  const child = await service.createCategory(actorId, {
    name: `Child ${suffix}`, slug: `child-${suffix}`, parentId: root.id,
    description: "A useful category", metaTitle: "Find tools", metaDescription: "Tools by category"
  });
  categoryIds.push(child.id);
  const replacement = await service.createCategory(actorId, { name: `Replacement ${suffix}`, slug: `replacement-${suffix}` });
  categoryIds.push(replacement.id);

  assert.equal(child.parentId, root.id);
  assert.equal(child.description, "A useful category");
  assert.equal((await service.listManagedCategories({ search: `Child ${suffix}`, limit: 20 })).items[0]?.parentName, root.name);
  await assert.rejects(service.updateCategory(root.id, actorId, { parentId: child.id }), /descendant/);
  await service.updateCategory(child.id, actorId, { parentId: replacement.id, metaTitle: "Updated tools" });
  assert.equal((await service.listManagedCategories({ search: `Child ${suffix}`, limit: 20 })).items[0]?.parentId, replacement.id);

  const image = Buffer.from([82, 73, 70, 70]);
  await service.setCategoryImage(child.id, actorId, image);
  assert.deepEqual((await service.getCategoryImage(child.id)).buffer, image);

  const product = await prisma.products.create({ data: { created_by_seller_id: sellerId, title: `Product ${suffix}`, slug: `category-product-${suffix}`, type: "physical", category_id: child.id } });
  productId = product.id;
  await assert.rejects(service.deleteCategory(replacement.id, actorId, { productAction: "uncategorize" }), /Move child categories/);
  assert.deepEqual(await service.deleteCategory(child.id, actorId, { productAction: "move", replacementCategoryId: root.id }), { deletedId: child.id, movedProducts: 1 });
  assert.equal((await prisma.products.findUniqueOrThrow({ where: { id: product.id }, select: { category_id: true } })).category_id, root.id);
  assert.ok(await prisma.product_category_events.findFirst({ where: { actor_user_id: actorId, category_id: null, after_data: { path: ["deleted"], equals: true } } }));
  assert.deepEqual(await service.deleteCategory(root.id, actorId, { productAction: "uncategorize" }), { deletedId: root.id, movedProducts: 1 });
  assert.equal((await prisma.products.findUniqueOrThrow({ where: { id: product.id }, select: { category_id: true } })).category_id, null);
});
