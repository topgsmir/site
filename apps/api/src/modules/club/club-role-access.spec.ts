import assert from "node:assert/strict";
import { test } from "node:test";
import type { PrismaService } from "../../prisma/prisma.service";
import { ClubService } from "./club.service";

test("staff purchasers retain club membership after a buyer role change", async () => {
  let upserted = false;
  const tx = {
    users: { findUnique: async () => ({ account_status: "active", role: "seller_admin" }) },
    club_members: { upsert: async () => { upserted = true; return { user_id: "staff-1" }; } }
  };
  const member = await new ClubService({} as PrismaService, {} as never).ensureMember(tx as never, "staff-1");
  assert.equal(member.user_id, "staff-1");
  assert.equal(upserted, true);
});

test("a blocked purchaser cannot replay a club point spend", async () => {
  let readEntry = false;
  const tx = {
    users: { findUnique: async () => ({ account_status: "blocked" }) },
    club_members: { upsert: () => { throw new Error("blocked user must not become a member"); } },
    club_point_entries: { findUnique: async () => { readEntry = true; return { user_id: "staff-1", delta: -10 }; } }
  };
  await assert.rejects(() => new ClubService({} as PrismaService, {} as never).spend(tx as never, "staff-1", 10, "spend-1", "checkout", "checkout-1"), /Active account not found/);
  assert.equal(readEntry, false);
});
