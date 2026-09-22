import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AppUser } from "@topgsm/shared-types";
import type { PrismaService } from "../../prisma/prisma.service";
import { OrderService } from "./order.service";

const seller: AppUser = {
  id: "seller-user-1",
  fullName: "Seller",
  email: "seller@example.com",
  role: "seller-admin",
  permissions: ["orders_manage"]
};

describe("new order count", () => {
  it("counts only paid orders for the authenticated seller tenant", async () => {
    let where: unknown;
    const seenAt = new Date("2026-09-22T10:00:00.000Z");
    const prisma = {
      seller_memberships: {
        findFirst: async () => ({ seller: { id: "seller-1" } })
      },
      users: {
        findUnique: async () => ({ orders_seen_at: seenAt })
      },
      orders: {
        count: async (args: { where: unknown }) => {
          where = args.where;
          return 4;
        }
      }
    } as unknown as PrismaService;

    const result = await new OrderService(prisma).newOrderCount(seller);

    assert.deepEqual(where, { seller_id: "seller-1", status: "paid", created_at: { gt: seenAt } });
    assert.deepEqual(result, { count: 4 });
  });

  it("counts paid orders platform-wide for an authorized platform admin", async () => {
    let where: unknown;
    const prisma = {
      users: {
        findUnique: async () => ({ orders_seen_at: null })
      },
      orders: {
        count: async (args: { where: unknown }) => {
          where = args.where;
          return 9;
        }
      }
    } as unknown as PrismaService;
    const admin: AppUser = {
      id: "admin-1",
      fullName: "Admin",
      email: "admin@example.com",
      role: "platform-admin"
    };

    assert.deepEqual(await new OrderService(prisma).newOrderCount(admin), { count: 9 });
    assert.deepEqual(where, { status: "paid" });
  });

  it("marks only the authenticated seller user's visible orders as seen", async () => {
    const latestCreatedAt = new Date("2026-09-22T11:00:00.000Z");
    let findWhere: unknown;
    let update: unknown;
    const prisma = {
      seller_memberships: {
        findFirst: async () => ({ seller: { id: "seller-1" } })
      },
      orders: {
        findFirst: async (args: { where: unknown }) => {
          findWhere = args.where;
          return { created_at: latestCreatedAt };
        }
      },
      users: {
        updateMany: async (args: unknown) => {
          update = args;
          return { count: 1 };
        }
      }
    } as unknown as PrismaService;

    assert.deepEqual(await new OrderService(prisma).markOrdersSeen(seller), { count: 0 });
    assert.deepEqual(findWhere, { seller_id: "seller-1" });
    assert.deepEqual(update, {
      where: {
        id: seller.id,
        OR: [{ orders_seen_at: null }, { orders_seen_at: { lt: latestCreatedAt } }]
      },
      data: { orders_seen_at: latestCreatedAt }
    });
  });

  it("keeps each platform admin's seen marker on that admin account", async () => {
    let update: unknown;
    const admin: AppUser = {
      id: "admin-2",
      fullName: "Second Admin",
      email: "admin-2@example.com",
      role: "platform-admin"
    };
    const prisma = {
      orders: { findFirst: async () => null },
      users: {
        updateMany: async (args: unknown) => {
          update = args;
          return { count: 1 };
        }
      }
    } as unknown as PrismaService;

    await new OrderService(prisma).markOrdersSeen(admin);

    assert.deepEqual(update, {
      where: {
        id: "admin-2",
        OR: [{ orders_seen_at: null }, { orders_seen_at: { lt: new Date(0) } }]
      },
      data: { orders_seen_at: new Date(0) }
    });
  });

  it("does not expose the operational count to buyers", async () => {
    const buyer: AppUser = {
      id: "buyer-1",
      fullName: "Buyer",
      email: "buyer@example.com",
      role: "buyer"
    };

    await assert.rejects(
      () => new OrderService({} as PrismaService).newOrderCount(buyer),
      /Seller or platform order access is required/
    );
    await assert.rejects(
      () => new OrderService({} as PrismaService).markOrdersSeen(buyer),
      /Seller or platform order access is required/
    );
  });
});
