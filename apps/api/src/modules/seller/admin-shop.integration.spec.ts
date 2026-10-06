import "reflect-metadata";
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { randomUUID } from "node:crypto";
import { ConfigService } from "@nestjs/config";
import { Test } from "@nestjs/testing";
import { Reflector } from "@nestjs/core";
import { ForbiddenException, ValidationPipe, type INestApplication } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { assertDedicatedTestDatabase } from "../../test/test-database";
import { AuthService } from "../auth/auth.service";
import { AuthLoginSettingsService } from "../auth/auth-login-settings.service";
import { AuthRateLimitService } from "../auth/auth-rate-limit.service";
import { SecurityPolicyService } from "../auth/security-policy.service";
import { BrowserMutationGuard } from "../auth/browser-mutation.guard";
import { RequestAuthenticationService } from "../auth/request-authentication.service";
import { SellerController } from "./seller.controller";
import { SellerService } from "./seller.service";
import { MediaService } from "../media/media.service";
import { ProductService } from "../product/product.service";
import { SellerProductsGuard } from "../product/seller-products.guard";
import { OrderService } from "../order/order.service";
import type { AuthenticatedRequest } from "../auth/platform-admin.guard";
import type { ExecutionContext } from "@nestjs/common";

assertDedicatedTestDatabase();
const prisma = new PrismaService();
const auth = new AuthService(prisma, new AuthLoginSettingsService(prisma));
const sellers = new SellerService(prisma, auth);
const authentication = new RequestAuthenticationService(auth);
const products = new ProductService(prisma, new ConfigService());
const orders = new OrderService(prisma);
let app: INestApplication;
let base: string;
const origin = "http://localhost:3000";

async function account(role: "platform_admin" | "platform_staff" | "buyer" = "platform_admin") {
  const user = await prisma.users.create({ data: { full_name: "Shop test", email: `${randomUUID()}@example.test`, role } });
  const session = await auth.createSessionForUser(user.id);
  const headers = { "content-type": "application/json", cookie: `topgsm_session=${session.token}`, origin };
  return { user, session, headers };
}

before(async () => {
  await prisma.$connect();
  const module = await Test.createTestingModule({ controllers: [SellerController], providers: [
    { provide: SellerService, useValue: sellers }, { provide: PrismaService, useValue: prisma },
    { provide: AuthService, useValue: auth }, { provide: RequestAuthenticationService, useValue: authentication },
    { provide: AuthRateLimitService, useValue: new AuthRateLimitService(prisma, new SecurityPolicyService(prisma)) },
    { provide: MediaService, useValue: {} }
  ] }).compile();
  app = module.createNestApplication({ logger: false });
  app.useGlobalGuards(new BrowserMutationGuard(new Reflector(), new ConfigService({ WEB_ORIGIN: origin })));
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true, forbidNonWhitelisted: true }));
  await app.listen(0, "127.0.0.1");
  base = await app.getUrl();
});
after(async () => { await app?.close(); await prisma.$disconnect(); });

test("own shop setup requires a current owner, valid input and the allowed browser origin", async () => {
  const admin = await account();
  const setup = (headers: Record<string, string>, body: unknown = { shopName: "My shop" }) => fetch(`${base}/seller/own-shop`, { method: "POST", headers, body: JSON.stringify(body) });
  assert.equal((await setup({ "content-type": "application/json" })).status, 401);
  for (const role of ["platform_staff", "buyer"] as const) assert.equal((await setup((await account(role)).headers)).status, 403);
  assert.equal((await setup({ ...admin.headers, origin: "http://evil.example" })).status, 403);
  assert.equal((await setup(admin.headers, { shopName: "  " })).status, 400);
  assert.equal((await setup(admin.headers, { shopName: "x".repeat(121) })).status, 400);
  assert.equal((await setup(admin.headers, { shopName: "My shop", userId: randomUUID() })).status, 400);
  const response = await setup(admin.headers, { shopName: "  فروشگاه مدیر  " });
  assert.equal(response.status, 201);
  const { sellerId } = await response.json() as { sellerId: string };
  const shop = await prisma.sellers.findUniqueOrThrow({ where: { id: sellerId } });
  assert.equal(shop.user_id, admin.user.id);
  assert.equal(shop.shop_name, "فروشگاه مدیر");
  assert.equal(shop.commission.toString(), "0");
  assert.equal((await auth.getUserFromToken(admin.session.token)).role, "platform-admin");
  assert.equal((await fetch(`${base}/seller/profile`, { headers: { ...admin.headers, "x-topgsm-workspace": "seller" } })).status, 200);
  assert.equal((await fetch(`${base}/seller/vendors`, { headers: { ...admin.headers, "x-topgsm-workspace": "seller" } })).status, 403);
  assert.equal((await fetch(`${base}/seller/vendors`, { headers: admin.headers })).status, 200);
});

test("concurrent setup creates one shop and never restores revoked access or resets settings", async () => {
  const { user, session } = await account();
  const results = await Promise.all(Array.from({ length: 5 }, () => sellers.createOwnShop(user.id, { shopName: "Concurrent shop" })));
  assert.equal(new Set(results.map((result) => result.sellerId)).size, 1);
  assert.equal(await prisma.sellers.count({ where: { user_id: user.id } }), 1);
  const sellerId = results[0].sellerId;
  assert.equal(await prisma.seller_memberships.count({ where: { user_id: user.id, active: true } }), 1);
  await prisma.sellers.update({ where: { id: sellerId }, data: { suspended_at: new Date(), commission: "0.2" } });
  await prisma.seller_permissions.deleteMany({ where: { seller_id: sellerId } });
  assert.deepEqual(await sellers.createOwnShop(user.id, { shopName: "Reset attempt" }), { sellerId });
  const unchanged = await prisma.sellers.findUniqueOrThrow({ where: { id: sellerId } });
  assert.ok(unchanged.suspended_at);
  assert.equal(unchanged.commission.toString(), "0.2");
  assert.equal(unchanged.shop_name, "Concurrent shop");
  assert.equal(await prisma.seller_permissions.count({ where: { seller_id: sellerId } }), 0);
  await assert.rejects(auth.inSellerWorkspace(await auth.getUserFromToken(session.token)), ForbiddenException);
});

test("admin selling creates owned, published offers and keeps orders isolated from another shop", async () => {
  const owner = await account();
  const other = await account();
  const buyer = await account("buyer");
  const ownShop = await sellers.createOwnShop(owner.user.id, { shopName: "Own shop" });
  const otherShop = await sellers.createOwnShop(other.user.id, { shopName: "Other shop" });
  const request: AuthenticatedRequest = { headers: { ...owner.headers, "x-topgsm-workspace": "seller" } };
  const context = { switchToHttp: () => ({ getRequest: () => request }) } as ExecutionContext;
  await new SellerProductsGuard(authentication, prisma).canActivate(context);
  assert.equal(request.sellerContext?.sellerId, ownShop.sellerId);
  const product = await products.createProduct(request.sellerContext!.sellerId, owner.user.id, {
    title: "Admin repair service", slug: `admin-repair-${randomUUID()}`, kind: "simple", type: "service", status: "active",
    offers: [{ price: "1000", currency: "TOMAN", service: { serviceType: "Repair", estimatedHours: 24 } }]
  });
  assert.equal(product.product.status, "active");
  assert.equal((await prisma.seller_listings.findUniqueOrThrow({ where: { id: product.id } })).seller_id, ownShop.sellerId);
  assert.equal(product.offers.length, 1);
  const ownOrder = await prisma.orders.create({ data: { buyer_id: buyer.user.id, seller_id: ownShop.sellerId, status: "paid", total_amount: "1000", currency: "TOMAN", commission_rate: "0", idempotency_key: randomUUID(), request_hash: "a".repeat(64) } });
  const foreignOrder = await prisma.orders.create({ data: { buyer_id: buyer.user.id, seller_id: otherShop.sellerId, status: "paid", total_amount: "2000", currency: "TOMAN", commission_rate: "0", idempotency_key: randomUUID(), request_hash: "b".repeat(64) } });
  const actor = request.authenticatedUser!;
  assert.equal((await orders.get(actor, ownOrder.id)).id, ownOrder.id);
  await assert.rejects(orders.get(actor, foreignOrder.id), { name: "NotFoundException" });
  assert.equal((await orders.get(await auth.getUserFromToken(owner.session.token), foreignOrder.id)).id, foreignOrder.id);
  await prisma.seller_memberships.updateMany({ where: { user_id: owner.user.id }, data: { active: false } });
  await assert.rejects(authentication.authenticate(request), ForbiddenException);
});

test("existing membership cannot be repurposed to sell as another shop", async () => {
  const admin = await account();
  const other = await account();
  const shop = await sellers.createOwnShop(other.user.id, { shopName: "Other shop" });
  await prisma.seller_memberships.create({ data: { user_id: admin.user.id, seller_id: shop.sellerId, role: "admin" } });
  await assert.rejects(sellers.createOwnShop(admin.user.id, { shopName: "Conflicting shop" }), { name: "ConflictException" });
  await assert.rejects(auth.inSellerWorkspace(await auth.getUserFromToken(admin.session.token)), ForbiddenException);
});
