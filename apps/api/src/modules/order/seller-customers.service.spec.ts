import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import type { AppUser } from "@topgsm/shared-types";
import type { PrismaService } from "../../prisma/prisma.service";
import { SellerCustomersService } from "./seller-customers.service";

const actor: AppUser = { id: "staff-1", fullName: "Seller", email: "seller@example.com", role: "seller-staff", permissions: ["orders_manage"] };
const customer = { id: "buyer-1", full_name: "Buyer", email: "buyer@example.com", phone_number: null, _count: { orders: 2 } };
const membership = { seller_id: "seller-1" };

describe("SellerCustomersService tenant boundary", () => {
  it("scopes search, exact support-code lookup, count, and cursor to the active seller", async () => {
    const queries: Record<string, unknown>[] = [];
    const prisma = {
      seller_memberships: { findFirst: async () => membership },
      users: {
        findFirst: async (args: Record<string, unknown>) => { queries.push(args); return null; },
        findMany: async (args: Record<string, unknown>) => { queries.push(args); return [customer]; }
      }
    } as unknown as PrismaService;
    const service = new SellerCustomersService(prisma);
    await service.search(actor, { search: "30109", limit: 20 });
    assert.deepEqual((queries[0]!.where as Record<string, unknown>).orders, { some: { seller_id: "seller-1" } });
    assert.equal((queries[0]!.where as Record<string, unknown>).support_code, "30109");
    const result = await service.search(actor, { search: "buyers", limit: 20 });
    assert.deepEqual((queries[2]!.where as Record<string, unknown>).orders, { some: { seller_id: "seller-1" } });
    assert.deepEqual((queries[2]!.select as { _count: { select: { orders: unknown } } })._count.select.orders, { where: { seller_id: "seller-1" } });
    assert.equal(result.items[0]?.orderCount, 2);
    await assert.rejects(service.search(actor, { search: "buyers", limit: 20, cursor: "other-buyer" }), BadRequestException);
    const cursorWhere = queries[3]!.where as { AND: Array<Record<string, unknown>> };
    assert.deepEqual(cursorWhere.AND[0]?.orders, { some: { seller_id: "seller-1" } });
  });

  it("hides buyers without a seller order before reading notes or orders", async () => {
    let privateReads = 0;
    const prisma = {
      seller_memberships: { findFirst: async () => membership },
      users: { findFirst: async (args: { where: Record<string, unknown> }) => {
        assert.deepEqual(args.where.orders, { some: { seller_id: "seller-1" } });
        return null;
      } },
      admin_user_notes: { findMany: async () => { privateReads++; return []; } },
      orders: { findMany: async () => { privateReads++; return []; } }
    } as unknown as PrismaService;
    await assert.rejects(new SellerCustomersService(prisma).detail(actor, "buyer-1", {}), NotFoundException);
    assert.equal(privateReads, 0);
  });

  it("reads only this seller's orders and validates order cursors under the same seller", async () => {
    let orderWhere: unknown;
    let cursorWhere: unknown;
    const prisma = {
      seller_memberships: { findFirst: async () => membership },
      users: { findFirst: async (args: { select: unknown }) => {
        assert.deepEqual((args.select as { _count: { select: { orders: unknown } } })._count.select.orders, { where: { seller_id: "seller-1" } });
        return customer;
      } },
      admin_user_notes: { findMany: async () => [] },
      orders: {
        findMany: async (args: { where: unknown }) => { orderWhere = args.where; return []; },
        findFirst: async (args: { where: unknown }) => { cursorWhere = args.where; return null; }
      }
    } as unknown as PrismaService;
    const service = new SellerCustomersService(prisma);
    const result = await service.detail(actor, "buyer-1", {});
    assert.deepEqual(orderWhere, { buyer_id: "buyer-1", seller_id: "seller-1" });
    assert.equal(result.customer.orderCount, 2);
    await assert.rejects(service.detail(actor, "buyer-1", { ordersCursor: "other-order" }), BadRequestException);
    assert.deepEqual(cursorWhere, { id: "other-order", buyer_id: "buyer-1", seller_id: "seller-1" });
  });

  it("requires current active seller membership and orders permission", async () => {
    const prisma = { seller_memberships: { findFirst: async (args: { where: unknown }) => {
      assert.deepEqual(args.where, { user_id: "staff-1", active: true, seller: { invited: false, approved: true, suspended_at: null, permissions: { some: { permission: "orders_manage" } } } });
      return null;
    } } } as unknown as PrismaService;
    await assert.rejects(new SellerCustomersService(prisma).search(actor, { search: "buyer", limit: 20 }), ForbiddenException);
  });
});
