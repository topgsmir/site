import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { PrismaService } from "../../prisma/prisma.service";
import type { AuthService } from "../auth/auth.service";
import { AdminUsersService } from "./admin-users.service";

const date = new Date("2026-09-13T08:00:00.000Z");
const user = { id: "3dd30b78-d1dc-44e0-a420-798e474b7a0a", support_code: "7K4P9", full_name: "Customer One", username: "customer", email: "customer@example.com", phone_number: "+989121234567", role: "buyer", created_at: date, updated_at: date, _count: { orders: 3 } };
const auth = { createPasswordHash: async () => "scrypt$hash" } as unknown as AuthService;

describe("AdminUsersService", () => {
  it("creates an audited buyer without exposing the initial password", async () => {
    let createData: Record<string, unknown> | undefined;
    let auditData: Record<string, unknown> | undefined;
    const tx = {
      users: { create: async (input: { data: Record<string, unknown> }) => {
        createData = input.data;
        return { ...user, role: "buyer", username: "new_buyer", phone_number: "+989172732188" };
      } },
      admin_user_profile_changes: { create: async (input: { data: Record<string, unknown> }) => { auditData = input.data; } }
    };
    const prisma = { $transaction: async (callback: (value: typeof tx) => unknown) => callback(tx) } as unknown as PrismaService;
    const created = await new AdminUsersService(prisma, auth).create("owner-id", {
      fullName: " New Buyer ", email: " NEW@example.com ", username: "new_buyer", phoneNumber: "09172732188", password: "initial-password"
    });
    assert.deepEqual(createData, { full_name: "New Buyer", email: "new@example.com", username: "new_buyer", phone_number: "+989172732188", password_hash: "scrypt$hash", role: "buyer" });
    assert.equal(auditData?.actor_user_id, "owner-id");
    assert.equal((auditData?.after_data as { accountCreated: boolean }).accountCreated, true);
    assert.equal(JSON.stringify(auditData).includes("initial-password"), false);
    assert.equal(JSON.stringify(auditData).includes("scrypt$hash"), false);
    assert.equal(JSON.stringify(created).includes("password"), false);
  });

  it("applies filters and stable pagination with a safe projection", async () => {
    let query: Record<string, unknown> | undefined;
    const prisma = { users: {
      count: async () => 1,
      findMany: async (input: Record<string, unknown>) => { query = input; return [user]; }
    } } as unknown as PrismaService;
    const service = new AdminUsersService(prisma, auth);
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
      id: true, support_code: true, full_name: true, username: true, email: true, phone_number: true,
      role: true, account_status: true, blocked_at: true, deleted_at: true, created_at: true, updated_at: true,
      _count: { select: { orders: true } }
    });
    assert.deepEqual(result, { items: [{ id: user.id, supportCode: user.support_code, fullName: user.full_name, username: user.username, email: user.email, phoneNumber: user.phone_number, role: user.role, accountStatus: undefined, blockedAt: null, deletedAt: null, orderCount: 3, createdAt: date.toISOString(), updatedAt: date.toISOString() }], page: 2, pageSize: 1, total: 1 });
  });

  it("finds a support code regardless of letter case", async () => {
    let where: Record<string, unknown> | undefined;
    let codeLookup: Record<string, unknown> | undefined;
    const prisma = { users: {
      count: async (input: { where: Record<string, unknown> }) => { where = input.where; return 1; },
      findUnique: async (input: { where: Record<string, unknown> }) => { codeLookup = input.where; return { id: user.id }; },
      findMany: async () => [user]
    } } as unknown as PrismaService;
    const result = await new AdminUsersService(prisma, auth).list({ page: 1, limit: 20, role: "all", sort: "newest", hasOrders: "all", hasPhone: "all", search: "7k4p9" });
    assert.deepEqual(codeLookup, { support_code: "7K4P9" });
    assert.deepEqual(where, { id: user.id });
    assert.equal(result.items[0]?.supportCode, "7K4P9");
  });

  it("resolves a support code before reading the administrative user detail", async () => {
    const lookups: unknown[] = [];
    const prisma = { users: { findUnique: async (input: { where: unknown }) => {
      lookups.push(input.where);
      return lookups.length === 1 ? { id: user.id } : user;
    } } } as unknown as PrismaService;
    const result = await new AdminUsersService(prisma, auth).detail("7k4p9");
    assert.deepEqual(lookups, [{ support_code: "7K4P9" }, { id: user.id }]);
    assert.equal(result.id, user.id);
    assert.equal(result.supportCode, "7K4P9");
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
    const service = new AdminUsersService(prisma, auth);
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
    const service = new AdminUsersService(prisma, auth);
    await service.update(user.id, user.id, { fullName: " New Name " });
    assert.deepEqual(updateData, { full_name: "New Name" });
    assert.equal(auditData?.user_id, user.id);
    assert.equal((auditData?.before_data as { fullName: string }).fullName, "Customer One");
  });

  it("stores an admin-edited phone in the format used by OTP login", async () => {
    let updateData: Record<string, unknown> | undefined;
    const tx = { $queryRaw: async () => [{ id: user.id }], users: { findUnique: async () => user, update: async (input: { data: Record<string, unknown> }) => { updateData = input.data; return { ...user, phone_number: String(input.data.phone_number) }; } }, admin_user_profile_changes: { create: async () => undefined } };
    const prisma = { $transaction: async (callback: (value: typeof tx) => unknown) => callback(tx) } as unknown as PrismaService;
    await new AdminUsersService(prisma, auth).update(user.id, user.id, { phoneNumber: "09172732188" });
    assert.deepEqual(updateData, { phone_number: "+989172732188" });
  });

  it("changes the password, revokes active sessions, and records only safe audit metadata atomically", async () => {
    let updateData: Record<string, unknown> | undefined;
    let sessionWhere: Record<string, unknown> | undefined;
    let auditData: Record<string, unknown> | undefined;
    const tx = {
      $queryRaw: async () => [{ id: user.id }],
      users: {
        findUnique: async () => ({ id: user.id, password_hash: "previous-hash" }),
        update: async (input: { data: Record<string, unknown> }) => { updateData = input.data; return { id: user.id }; }
      },
      auth_sessions: {
        updateMany: async (input: { where: Record<string, unknown> }) => { sessionWhere = input.where; return { count: 2 }; }
      },
      admin_user_profile_changes: {
        create: async (input: { data: Record<string, unknown> }) => { auditData = input.data; }
      }
    };
    const prisma = { $transaction: async (callback: (value: typeof tx) => unknown) => callback(tx) } as unknown as PrismaService;

    const result = await new AdminUsersService(prisma, auth).changePassword(user.id, "owner-id", "new-password-value");

    assert.deepEqual(updateData, { password_hash: "scrypt$hash" });
    assert.equal(sessionWhere?.user_id, user.id);
    assert.equal(sessionWhere?.revoked_at, null);
    assert.deepEqual(result, { sessionsRevoked: 2 });
    assert.equal(JSON.stringify(auditData).includes("scrypt$hash"), false);
    assert.equal(JSON.stringify(auditData).includes("new-password-value"), false);
    assert.equal((auditData?.after_data as { sessionsRevoked: number }).sessionsRevoked, 2);
  });
});
