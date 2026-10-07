import assert from "node:assert/strict";
import { it } from "node:test";
import { ConflictException, NotFoundException } from "@nestjs/common";
import type { PrismaService } from "../../prisma/prisma.service";
import type { AuthService } from "../auth/auth.service";
import { StaffService } from "./staff.service";

const userId = "3dd30b78-d1dc-44e0-a420-798e474b7a0a";

it("resolves a support code before locking and updating a staff user", async () => {
  let staffWhere: unknown;
  const transaction = {
    $queryRaw: async () => [],
    users: {
      findUnique: async () => ({ role: "platform_admin", account_status: "active", password_hash: "hash" }),
      findFirst: async (input: { where: unknown }) => { staffWhere = input.where; return null; }
    }
  };
  const prisma = {
    users: { findUnique: async (input: { where: unknown }) => { assert.deepEqual(input.where, { support_code: "01409" }); return { id: userId }; } },
    $transaction: async (callback: (tx: typeof transaction) => unknown) => callback(transaction)
  } as unknown as PrismaService;
  await assert.rejects(new StaffService(prisma, {} as AuthService).update("01409", {}, "owner-id"), NotFoundException);
  assert.deepEqual(staffWhere, { id: userId, role: "platform_staff" });
});

it("recognizes a staff support code on the invitation-or-user route without revoking the user", async () => {
  let staffWhere: unknown;
  const prisma = {
    platform_staff_invitations: { updateMany: async () => { throw new Error("support code is not an invitation ID"); } },
    users: { findFirst: async (input: { where: unknown }) => { staffWhere = input.where; return { id: userId }; } }
  } as unknown as PrismaService;
  await assert.rejects(new StaffService(prisma, {} as AuthService).revoke("01409"), ConflictException);
  assert.deepEqual(staffWhere, { support_code: "01409", role: "platform_staff" });
});
