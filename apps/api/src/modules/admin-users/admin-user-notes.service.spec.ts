import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ConflictException } from "@nestjs/common";
import type { PrismaService } from "../../prisma/prisma.service";
import { AdminUserNotesService } from "./admin-user-notes.service";

describe("AdminUserNotesService", () => {
  const userId = "123e4567-e89b-42d3-a456-426614174000";
  it("resolves a support code before reading the user's notes", async () => {
    let notesWhere: unknown;
    const prisma = {
      users: { findUnique: async (input: { where: unknown }) => {
        if ("support_code" in (input.where as object)) { assert.deepEqual(input.where, { support_code: "01409" }); return { id: userId }; }
        return { id: userId };
      } },
      admin_user_notes: { findMany: async (input: { where: unknown }) => { notesWhere = input.where; return []; } }
    } as unknown as PrismaService;
    await new AdminUserNotesService(prisma).list("01409", { limit: 10 });
    assert.deepEqual(notesWhere, { user_id: userId });
  });
  it("locks and checks the account before saving a trimmed, attributed note", async () => {
    let data: unknown;
    let locked = false;
    const row = { id: "note-1", body: "Documented behavior", seller_visible: true, created_at: new Date("2026-09-27T12:00:00Z"), actor: { full_name: "Admin" } };
    const tx = {
      $queryRaw: async () => { locked = true; return []; },
      users: { findUnique: async () => { assert.equal(locked, true); return { account_status: "active" }; } },
      admin_user_notes: { create: async (args: { data: unknown }) => { data = args.data; return row; } }
    };
    const prisma = { $transaction: async (callback: (transaction: typeof tx) => unknown) => callback(tx) } as unknown as PrismaService;
    const result = await new AdminUserNotesService(prisma).create(userId, "admin-1", "  Documented behavior  ", true);
    assert.deepEqual(data, { user_id: userId, actor_user_id: "admin-1", body: "Documented behavior", seller_visible: true });
    assert.deepEqual(result, { id: "note-1", body: "Documented behavior", authorName: "Admin", sellerVisible: true, createdAt: "2026-09-27T12:00:00.000Z" });
  });

  it("refuses notes for an account being deleted", async () => {
    const tx = { $queryRaw: async () => [], users: { findUnique: async () => ({ account_status: "deletion_pending" }) }, admin_user_notes: { create: async () => { throw new Error("should not create"); } } };
    const prisma = { $transaction: async (callback: (transaction: typeof tx) => unknown) => callback(tx) } as unknown as PrismaService;
    await assert.rejects(new AdminUserNotesService(prisma).create(userId, "admin-1", "Concern", false), ConflictException);
  });
});
