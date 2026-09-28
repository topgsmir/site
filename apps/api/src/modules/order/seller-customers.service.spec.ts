import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { BadRequestException, ForbiddenException, NotFoundException } from "@nestjs/common";
import type { AppUser } from "@topgsm/shared-types";
import type { PrismaService } from "../../prisma/prisma.service";
import { SellerCustomersService } from "./seller-customers.service";

const actor: AppUser = { id: "seller-user", fullName: "Seller", email: "seller@example.com", role: "seller-admin", permissions: ["orders_manage"] };
const customer = { id: "buyer-1", full_name: "Buyer", email: "buyer@example.com", phone_number: null, _count: { orders: 2 } };

describe("SellerCustomersService", () => {
  it("searches users across shops with their total order counts", async () => {
    let membershipWhere: unknown;
    let userQuery: Record<string, unknown> | undefined;
    const prisma = {
      seller_memberships: { findFirst: async (args: { where: unknown }) => { membershipWhere = args.where; return { seller_id: "seller-1" }; } },
      users: { findUnique: async () => null, findFirst: async () => null, findMany: async (args: Record<string, unknown>) => { userQuery = args; return [customer]; } }
    } as unknown as PrismaService;
    const result = await new SellerCustomersService(prisma).search(actor, { search: " Buyer ", limit: 20 });
    assert.deepEqual(membershipWhere, { user_id: actor.id, active: true, seller: { invited: false, approved: true, suspended_at: null, permissions: { some: { permission: "orders_manage" } } } });
    assert.deepEqual((userQuery?.where as { account_status: unknown }).account_status, { not: "deleted" });
    assert.equal((userQuery?.where as { orders?: unknown }).orders, undefined);
    assert.deepEqual(((userQuery?.select as { _count: { select: { orders: unknown } } })._count.select.orders), true);
    assert.equal(userQuery?.take, 21);
    assert.equal(result.items[0]?.orderCount, 2);
  });

  it("finds an exact support code even without an order at this seller", async () => {
    let codeWhere: unknown;
    let privateListReads = 0;
    const prisma = {
      seller_memberships: { findFirst: async () => ({ seller_id: "seller-1" }) },
      users: {
        findUnique: async (input: { where: unknown }) => { codeWhere = input.where; return { ...customer, support_code: "3UKM9", account_status: "active", _count: { orders: 0 } }; },
        findMany: async () => { privateListReads++; return []; }
      }
    } as unknown as PrismaService;
    const result = await new SellerCustomersService(prisma).search(actor, { search: "3ukm9", limit: 20 });
    assert.deepEqual(codeWhere, { support_code: "3UKM9" });
    assert.deepEqual(result.items, [{ id: customer.id, fullName: customer.full_name, email: customer.email, phoneNumber: customer.phone_number, orderCount: 0 }]);
    assert.equal(privateListReads, 0);
  });

  it("returns total orders for an exact code", async () => {
    const prisma = {
      seller_memberships: { findFirst: async () => ({ seller_id: "seller-1" }) },
      users: { findUnique: async () => ({ ...customer, support_code: "3UKM9", account_status: "active" }) }
    } as unknown as PrismaService;
    const result = await new SellerCustomersService(prisma).search(actor, { search: "3UKM9", limit: 20 });
    assert.deepEqual(result.items, [{ id: customer.id, fullName: customer.full_name, email: customer.email, phoneNumber: customer.phone_number, orderCount: 2 }]);
  });

  it("does not read notes or orders for a missing user", async () => {
    let privateReads = 0;
    const prisma = {
      seller_memberships: { findFirst: async () => ({ seller_id: "seller-1" }) },
      users: { findFirst: async (args: { where: unknown }) => { assert.deepEqual(args.where, { id: "buyer-1", account_status: { not: "deleted" } }); return null; } },
      admin_user_notes: { findMany: async () => { privateReads++; return []; } },
      orders: { findMany: async () => { privateReads++; return []; } }
    } as unknown as PrismaService;
    await assert.rejects(new SellerCustomersService(prisma).detail(actor, "buyer-1", {}), NotFoundException);
    assert.equal(privateReads, 0);
  });

  it("reads orders across shops while keeping notes seller-visible", async () => {
    let orderWhere: unknown;
    let notesWhere: unknown;
    const prisma = {
      seller_memberships: { findFirst: async () => ({ seller_id: "seller-1" }) },
      users: { findFirst: async () => customer },
      admin_user_notes: { findMany: async (args: { where: unknown }) => { notesWhere = args.where; return []; } },
      orders: { findMany: async (args: { where: unknown }) => { orderWhere = args.where; return [{ id: "order-1", status: "paid", total_amount: { toString: () => "120" }, currency: "TOMAN", created_at: new Date("2026-09-28T00:00:00Z"), seller: { shop_name: "Other shop" }, items: [] }]; } }
    } as unknown as PrismaService;
    const result = await new SellerCustomersService(prisma).detail(actor, "buyer-1", {});
    assert.deepEqual(orderWhere, { buyer_id: "buyer-1" });
    assert.deepEqual(notesWhere, { user_id: "buyer-1", seller_visible: true });
    assert.equal(result.customer.orderCount, 2);
    assert.equal(result.orders.items[0]?.shopName, "Other shop");
  });

  it("uses a support code to load a customer while keeping subsequent reads on the internal UUID", async () => {
    let customerWhere: unknown;
    let orderWhere: unknown;
    const prisma = {
      seller_memberships: { findFirst: async () => ({ seller_id: "seller-1" }) },
      users: { findFirst: async (input: { where: unknown }) => { customerWhere = input.where; return customer; } },
      admin_user_notes: { findMany: async () => [] },
      orders: { findMany: async (input: { where: unknown }) => { orderWhere = input.where; return []; } }
    } as unknown as PrismaService;
    await new SellerCustomersService(prisma).detail(actor, "7k4p9", {});
    assert.deepEqual(customerWhere, { support_code: "7K4P9", account_status: { not: "deleted" } });
    assert.deepEqual(orderWhere, { buyer_id: customer.id });
  });

  it("reads a user's seller-visible notes even when they have no orders", async () => {
    let notesWhere: unknown;
    let ordersWhere: unknown;
    const prisma = {
      seller_memberships: { findFirst: async () => ({ seller_id: "seller-1" }) },
      users: { findFirst: async () => ({ ...customer, support_code: "3UKM9", _count: { orders: 0 } }) },
      admin_user_notes: { findMany: async (args: { where: unknown }) => { notesWhere = args.where; return [{ id: "note-1", body: "Shared", created_at: new Date("2026-09-28T00:00:00Z") }]; } },
      orders: { findMany: async (args: { where: unknown }) => { ordersWhere = args.where; return []; } }
    } as unknown as PrismaService;
    const result = await new SellerCustomersService(prisma).detail(actor, "3UKM9", {});
    assert.deepEqual(notesWhere, { user_id: customer.id, seller_visible: true });
    assert.deepEqual(ordersWhere, { buyer_id: customer.id });
    assert.equal(result.customer.fullName, customer.full_name);
    assert.equal(result.notes.items[0]?.body, "Shared");
    assert.deepEqual(result.orders.items, []);
  });

  it("rejects an admin-only note as a pagination cursor", async () => {
    const prisma = {
      seller_memberships: { findFirst: async () => ({ seller_id: "seller-1" }) },
      users: { findFirst: async () => customer },
      admin_user_notes: { findFirst: async (args: { where: unknown }) => { assert.deepEqual(args.where, { id: "hidden-note", user_id: "buyer-1", seller_visible: true }); return null; }, findMany: async () => { throw new Error("should not read notes"); } },
      orders: { findMany: async () => { throw new Error("should not read orders"); } }
    } as unknown as PrismaService;
    await assert.rejects(new SellerCustomersService(prisma).detail(actor, "buyer-1", { notesCursor: "hidden-note" }), BadRequestException);
  });

  it("accepts an order cursor from another shop only for the selected buyer", async () => {
    let cursorWhere: unknown;
    const prisma = {
      seller_memberships: { findFirst: async () => ({ seller_id: "seller-1" }) },
      users: { findFirst: async () => customer },
      admin_user_notes: { findMany: async () => [] },
      orders: {
        findFirst: async (args: { where: unknown }) => { cursorWhere = args.where; return { id: "other-shop-order" }; },
        findMany: async (args: { cursor: unknown }) => { assert.deepEqual(args.cursor, { id: "other-shop-order" }); return []; }
      }
    } as unknown as PrismaService;
    await new SellerCustomersService(prisma).detail(actor, "buyer-1", { ordersCursor: "other-shop-order" });
    assert.deepEqual(cursorWhere, { id: "other-shop-order", buyer_id: "buyer-1" });
  });

  it("rejects a seller without an active orders permission", async () => {
    const prisma = { seller_memberships: { findFirst: async () => null }, users: { findMany: async () => { throw new Error("should not query users"); } } } as unknown as PrismaService;
    await assert.rejects(new SellerCustomersService(prisma).search(actor, { search: "buyer", limit: 20 }), ForbiddenException);
  });

  it("pages matching customers and rejects a cursor outside the seller's matching result", async () => {
    const prisma = {
      seller_memberships: { findFirst: async () => ({ seller_id: "seller-1" }) },
      users: {
        findUnique: async () => null,
        findFirst: async () => null,
        findMany: async (args: { take: number }) => { assert.equal(args.take, 2); return [customer, { ...customer, id: "buyer-2" }]; }
      }
    } as unknown as PrismaService;
    const service = new SellerCustomersService(prisma);
    const first = await service.search(actor, { search: "buyer", limit: 1 });
    assert.deepEqual(first.items.map((item) => item.id), ["buyer-1"]);
    assert.equal(first.nextCursor, "buyer-1");
    await assert.rejects(service.search(actor, { search: "buyer", limit: 1, cursor: "other-buyer" }), BadRequestException);
  });

  it("resolves a customer support code used as a pagination cursor within the seller's results", async () => {
    let cursorWhere: unknown;
    let pageCursor: unknown;
    const prisma = {
      seller_memberships: { findFirst: async () => ({ seller_id: "seller-1" }) },
      users: {
        findUnique: async () => null,
        findFirst: async (input: { where: unknown }) => {
          const where = input.where as Record<string, unknown>;
          if (where.AND) { cursorWhere = where; return { id: customer.id }; }
          return null;
        },
        findMany: async (input: { cursor?: unknown }) => { pageCursor = input.cursor; return []; }
      }
    } as unknown as PrismaService;
    await new SellerCustomersService(prisma).search(actor, { search: "buyer", limit: 20, cursor: "7k4p9" });
    assert.deepEqual((cursorWhere as { AND: unknown[] }).AND[1], { support_code: "7K4P9" });
    assert.deepEqual(pageCursor, { id: customer.id });
  });
});
