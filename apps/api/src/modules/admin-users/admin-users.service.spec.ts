import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { PrismaService } from "../../prisma/prisma.service";
import { AdminUsersService } from "./admin-users.service";

const date = new Date("2026-09-13T08:00:00.000Z");
const user = { id: "3dd30b78-d1dc-44e0-a420-798e474b7a0a", full_name: "Customer One", username: "customer", email: "customer@example.com", phone_number: "+989121234567", role: "buyer", created_at: date, updated_at: date, _count: { orders: 3 } };

describe("AdminUsersService", () => {
  it("applies filters and stable pagination with a safe projection", async () => {
    let query: Record<string, unknown> | undefined;
    const prisma = { users: {
      count: async () => 1,
      findMany: async (input: Record<string, unknown>) => { query = input; return [user]; }
    } } as unknown as PrismaService;
    const service = new AdminUsersService(prisma);
    const result = await service.list({ page: 2, limit: 1, role: "buyer", sort: "newest", hasOrders: "yes", hasPhone: "yes", search: "customer" });
    assert.deepEqual(query?.where, {
      role: "buyer",
      OR: [
        { full_name: { contains: "customer", mode: "insensitive" } },
        { username: { contains: "customer", mode: "insensitive" } },
        { email: { contains: "customer", mode: "insensitive" } },
        { phone_number: { contains: "customer" } }
      ],
      orders: { some: {} }, phone_number: { not: null }
    });
    assert.deepEqual(query?.orderBy, [{ created_at: "desc" }, { id: "desc" }]);
    assert.equal(query?.skip, 1);
    assert.equal(query?.take, 1);
    assert.deepEqual(query?.select, {
      id: true, full_name: true, username: true, email: true, phone_number: true,
      role: true, created_at: true, updated_at: true,
      _count: { select: { orders: true } }
    });
    assert.deepEqual(result, { items: [{ id: user.id, fullName: user.full_name, username: user.username, email: user.email, phoneNumber: user.phone_number, role: user.role, orderCount: 3, createdAt: date.toISOString(), updatedAt: date.toISOString() }], page: 2, pageSize: 1, total: 1 });
  });

  it("fetches only the requested order page even when a customer has 1000 orders", async () => {
    let orderQuery: Record<string, unknown> | undefined;
    const prisma = {
      users: { findUnique: async () => user },
      orders: {
        count: async () => 1000,
        findMany: async (input: Record<string, unknown>) => { orderQuery = input; return []; }
      }
    } as unknown as PrismaService;
    const service = new AdminUsersService(prisma);
    const result = await service.history(user.id, { section: "orders", page: 50, limit: 20 });
    assert.deepEqual(orderQuery?.where, { buyer_id: user.id });
    assert.equal(orderQuery?.skip, 980);
    assert.equal(orderQuery?.take, 20);
    assert.deepEqual(result, { items: [], page: 50, pageSize: 20, total: 1000 });
  });

  it("writes a profile change in the same transaction and never updates role", async () => {
    let updateData: Record<string, unknown> | undefined;
    let auditData: Record<string, unknown> | undefined;
    const tx = { $queryRaw: async () => [{ id: user.id }], users: { findUnique: async () => user, update: async (input: { data: Record<string, unknown> }) => { updateData = input.data; return { ...user, full_name: "New Name" }; } }, admin_user_profile_changes: { create: async (input: { data: Record<string, unknown> }) => { auditData = input.data; } } };
    const prisma = { $transaction: async (callback: (value: typeof tx) => unknown) => callback(tx) } as unknown as PrismaService;
    const service = new AdminUsersService(prisma);
    await service.update(user.id, user.id, { fullName: " New Name " });
    assert.deepEqual(updateData, { full_name: "New Name" });
    assert.equal(auditData?.user_id, user.id);
    assert.equal((auditData?.before_data as { fullName: string }).fullName, "Customer One");
  });

  it("stores an admin-edited phone in the format used by OTP login", async () => {
    let updateData: Record<string, unknown> | undefined;
    const tx = { $queryRaw: async () => [{ id: user.id }], users: { findUnique: async () => user, update: async (input: { data: Record<string, unknown> }) => { updateData = input.data; return { ...user, phone_number: String(input.data.phone_number) }; } }, admin_user_profile_changes: { create: async () => undefined } };
    const prisma = { $transaction: async (callback: (value: typeof tx) => unknown) => callback(tx) } as unknown as PrismaService;
    await new AdminUsersService(prisma).update(user.id, user.id, { phoneNumber: "09172732188" });
    assert.deepEqual(updateData, { phone_number: "+989172732188" });
  });
});
