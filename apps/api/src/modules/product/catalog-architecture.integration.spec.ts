import "reflect-metadata";
import assert from "node:assert/strict";
import { before, after, describe, it } from "node:test";
import { randomUUID } from "node:crypto";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";
import { assertDedicatedTestDatabase } from "../../test/test-database";
import { ProductService } from "./product.service";
import { AnalyticsService } from "../analytics/analytics.service";
import { AnalyticsOverviewQueryDto } from "../analytics/dto/analytics.dto";
import { AdminUploadsService } from "../media/admin-uploads.service";
import { AdminUploadsQueryDto } from "../media/dto/admin-uploads.dto";
import type { MediaService } from "../media/media.service";

assertDedicatedTestDatabase();
const prisma = new PrismaService();
const service = new ProductService(prisma,new ConfigService({ BRIDGE_FEATURE_ENABLED: "false" }));
const suffix = randomUUID().slice(0,8);
let actorId: string;
let sellerId: string;
let categoryId: string;
let productId: string;

before(async () => {
  const user = await prisma.users.create({ data: { full_name: "Catalog architecture", email: `architecture-${suffix}@example.test`, role: "platform_admin" } });
  actorId=user.id;
  const seller=await prisma.sellers.create({ data: { user_id: user.id, shop_name: "Architecture", approved: true,
    permissions: { create: [{ permission: "products_publish" },{ permission: "physical_products_manage" }] } } });
  sellerId=seller.id;
});
after(async () => {
  await prisma.product_category_events.deleteMany({ where: { actor_user_id: actorId } });
  await prisma.product_change_events.deleteMany({ where: { actor_user_id: actorId } });
  await prisma.seller_listings.deleteMany({ where: { seller_id: sellerId } });
  await prisma.products.deleteMany({ where: { created_by_seller_id: sellerId } });
  if(categoryId) await prisma.product_categories.delete({ where: { id: categoryId } });
  await prisma.product_categories.deleteMany({ where: { name: { contains: suffix } } });
  await prisma.sellers.delete({ where: { id: sellerId } });
  await prisma.users.delete({ where: { id: actorId } });
  await prisma.$disconnect();
});

describe("catalog architecture", () => {
  it("deduplicates concurrent legacy labels and supports stable ID assignment", async () => {
    const results=await Promise.all(["Repair  Tools", "repair tools"].map((label,i)=>service.createProduct(sellerId,actorId,{
      title: `Architecture ${suffix} ${i}`,slug: `architecture-${suffix}-${i}`,kind: "simple",type: "physical",category: `${label} ${suffix}`,
      offers: [{ price: "1000",currency: "TOMAN",physical: { stock: 5,weightGrams: 100 } }]
    })));
    categoryId=results[0].product.categoryId!;
    productId=results[0].product.id;
    assert.ok(categoryId);
    assert.equal(results[1].product.categoryId,categoryId);
    await service.updateAdminProduct(results[1].product.id,actorId,{ categoryId });
    await assert.rejects(service.updateAdminProduct(productId,actorId,{ categoryId: randomUUID() }),/category was not found/);
    await assert.rejects(service.updateAdminProduct(productId,actorId,{ categoryId,category: "ambiguous" }),/not both/);
  });

  it("renames one category without rewriting product membership and records the actor", async () => {
    const before=await prisma.products.findUniqueOrThrow({ where: { id: productId },select: { updated_at: true } });
    await service.updateCategory(categoryId,actorId,{ name: `Renamed ${suffix}`,translations: [{ locale: "en",name: `Shared tools ${suffix}` }] });
    const page=await service.listPublicPage({ limit: 50,categoryId,locale: "en" });
    assert.equal(page.items.length,2);
    assert.ok(page.items.every((item)=>item.category===`Shared tools ${suffix}` && item.categoryId===categoryId));
    assert.equal((await service.listPublicPage({ limit: 50,locale: "en",search: `Shared tools ${suffix}` })).items.length,2);
    assert.equal((await prisma.products.findUniqueOrThrow({ where: { id: productId } })).updated_at.getTime(),before.updated_at.getTime());
    assert.equal(await prisma.product_category_events.count({ where: { category_id: categoryId,actor_user_id: actorId } }),1);
  });

  it("uses UUID parameters for prices, slug lookup, and history restore", async () => {
    const product=await service.getPublic(`architecture-${suffix}-0`);
    assert.equal(product.id,productId);
    assert.equal((await service.getPublic(productId)).id,productId);
    const updated=await service.updateAdminProduct(productId,actorId,{ category: `Other ${suffix}` });
    const change=await prisma.product_change_events.findFirstOrThrow({ where: { product_id: productId,action: "update" },orderBy: [{ created_at: "desc" },{ id: "desc" }] });
    assert.notEqual(updated.categoryId,categoryId);
    await service.updateCategory(updated.categoryId!,actorId,{ name: `Other renamed ${suffix}` });
    await service.bulkUndo({ mode: "last",count: 1,operator: "and",operationId: randomUUID(),changeIds: [change.id] },actorId);
    assert.equal((await service.getPublic(productId)).categoryId,categoryId);
    await service.updateAdminProduct(productId,actorId,{ categoryId: null });
    assert.equal((await service.getPublic(productId)).categoryId,null);
    await service.updateAdminProduct(productId,actorId,{ categoryId });
  });

  it("keeps management pagination stable in both directions", async () => {
    for(const sort of ["updated_asc","updated_desc","created_asc","created_desc","title_asc","title_desc"] as const){
      const first=await service.listAdminProducts({ limit: 1,categoryId,sort });
      assert.ok(first.nextCursor);
      const second=await service.listAdminProducts({ limit: 1,categoryId,sort,cursor: first.nextCursor });
      assert.equal(second.items.length,1); assert.notEqual(first.items[0].id,second.items[0].id);
      const sellerFirst=await service.listSellerListings(sellerId,{ limit: 1,categoryId,sort });
      const sellerSecond=await service.listSellerListings(sellerId,{ limit: 1,categoryId,sort,cursor: sellerFirst.nextCursor! });
      assert.equal(sellerSecond.items.length,1); assert.notEqual(sellerFirst.items[0].id,sellerSecond.items[0].id);
    }
  });

  it("uses ordered indexes on a 30,000-product catalog", async () => {
    await prisma.$executeRaw`
      INSERT INTO products(id,created_by_seller_id,title,slug,type,status,category_id)
      SELECT md5(${suffix} || ':product:' || n)::uuid,${sellerId},'Scale product '||n,${suffix}||'-scale-'||n,'physical','draft',${categoryId}::uuid
      FROM generate_series(1,30000) n
    `;
    await prisma.$executeRaw`
      INSERT INTO seller_listings(id,seller_id,product_id)
      SELECT md5(${suffix} || ':listing:' || n)::uuid,${sellerId},md5(${suffix} || ':product:' || n)::uuid FROM generate_series(1,30000) n
    `;
    await prisma.$executeRaw`ANALYZE products`;
    await prisma.$executeRaw`ANALYZE seller_listings`;
    const plans = [
      await prisma.$queryRaw`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT id FROM products ORDER BY updated_at DESC,id DESC LIMIT 50`,
      await prisma.$queryRaw`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT id FROM products ORDER BY title,id LIMIT 50`,
      await prisma.$queryRaw`EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) SELECT id FROM seller_listings WHERE seller_id=${sellerId} ORDER BY updated_at DESC,id DESC LIMIT 50`
    ];
    for(const [i,plan] of plans.entries()){
      const encoded=JSON.stringify(plan);
      assert.ok(encoded.includes(["products_updated_at_id_idx","products_title_id_idx","seller_listings_seller_id_updated_at_id_idx"][i]),encoded);
      assert.ok(!encoded.includes('"Node Type":"Sort"'),encoded);
    }
  });

  it("keeps analytics and the mixed blog/product media inventory compatible", async () => {
    const overview = await new AnalyticsService(prisma).overview({ id: actorId,role: "platform-admin",fullName: "Catalog architecture",email: null },new AnalyticsOverviewQueryDto());
    assert.equal(overview.scope,"admin");
    const inventory = await new AdminUploadsService(prisma,{} as MediaService).list(new AdminUploadsQueryDto());
    assert.ok(Array.isArray(inventory.items));
  });
});
