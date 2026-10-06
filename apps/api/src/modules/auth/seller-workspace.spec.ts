import assert from "node:assert/strict";
import { test } from "node:test";
import { ForbiddenException, type ExecutionContext } from "@nestjs/common";
import type { AppUser } from "@topgsm/shared-types";
import type { PrismaService } from "../../prisma/prisma.service";
import { AuthService } from "./auth.service";
import type { AuthLoginSettingsService } from "./auth-login-settings.service";
import { RequestAuthenticationService } from "./request-authentication.service";
import { PlatformAdminGuard, type AuthenticatedRequest } from "./platform-admin.guard";
import { SellerProductsGuard } from "../product/seller-products.guard";

const owner: AppUser = { id: "owner", fullName: "Owner", email: "owner@example.test", role: "platform-admin", isPlatformOwner: true, platformPermissions: ["orders_manage"] };

test("seller workspace derives ownership and permissions and removes platform authority", async () => {
  const prisma = { seller_memberships: { findFirst: async (query: unknown) => {
    assert.deepEqual(query, {
      where: { user_id: "owner", active: true, role: "admin", seller: { user_id: "owner", invited: false, approved: true, suspended_at: null, merged_into_seller_id: null } },
      select: { seller_id: true, seller: { select: { permissions: { select: { permission: true } } } } }
    });
    return { seller_id: "own-shop", seller: { permissions: [{ permission: "products_manage" }] } };
  } } } as unknown as PrismaService;
  const result = await new AuthService(prisma, {} as AuthLoginSettingsService).inSellerWorkspace(owner);
  assert.equal(result.id, owner.id);
  assert.equal(result.role, "seller-admin");
  assert.equal(result.sellerId, "own-shop");
  assert.deepEqual(result.permissions, ["products_manage"]);
  assert.deepEqual(result.platformPermissions, []);
  assert.equal(result.isPlatformOwner, false);
  assert.equal(owner.role, "platform-admin");
  assert.equal(owner.isPlatformOwner, true);
});

test("rejects seller mode when the ownership lookup finds no active shop", async () => {
  const prisma = { seller_memberships: { findFirst: async () => null } } as unknown as PrismaService;
  await assert.rejects(new AuthService(prisma, {} as AuthLoginSettingsService).inSellerWorkspace(owner), ForbiddenException);
});

test("workspace requests cannot elevate buyers, platform staff or seller staff", async () => {
  const auth = new AuthService({} as PrismaService, {} as AuthLoginSettingsService);
  for (const role of ["buyer", "platform-staff", "seller-staff", "seller-admin"] as const) {
    const user = { ...owner, role, isPlatformOwner: false, platformPermissions: [] };
    assert.equal(await auth.inSellerWorkspace(user), user);
  }
});

test("request context preserves the admin session and enforces normal seller guards", async () => {
  const seller = { ...owner, role: "seller-admin" as const, isPlatformOwner: false, platformPermissions: [] };
  const auth = { getUserFromToken: async () => owner, inSellerWorkspace: async () => seller } as unknown as AuthService;
  const authentication = new RequestAuthenticationService(auth);
  const adminRequest: AuthenticatedRequest = { headers: {} };
  const sellerRequest: AuthenticatedRequest = { headers: { "x-topgsm-workspace": "seller" } };
  const context = (request: AuthenticatedRequest) => ({ switchToHttp: () => ({ getRequest: () => request }) }) as ExecutionContext;
  assert.equal(await authentication.authenticate(adminRequest), owner);
  assert.equal(await authentication.authenticate(sellerRequest), seller);
  assert.equal(await new PlatformAdminGuard(authentication).canActivate(context(adminRequest)), true);
  await assert.rejects(new PlatformAdminGuard(authentication).canActivate(context(sellerRequest)), ForbiddenException);
  const prisma = { seller_memberships: { findFirst: async () => ({ role: "admin", seller: { id: "own-shop" } }) } } as unknown as PrismaService;
  assert.equal(await new SellerProductsGuard(authentication, prisma).canActivate(context(sellerRequest)), true);
  assert.equal(sellerRequest.sellerContext?.sellerId, "own-shop");
  await assert.rejects(new SellerProductsGuard(authentication, prisma).canActivate(context(adminRequest)), ForbiddenException);
});
