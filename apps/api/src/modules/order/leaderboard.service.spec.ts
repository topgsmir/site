import assert from "node:assert/strict";
import { test } from "node:test";
import { ForbiddenException } from "@nestjs/common";
import type { AppUser } from "@topgsm/shared-types";
import { LeaderboardService } from "./leaderboard.service";
import type { PrismaService } from "../../prisma/prisma.service";

const buyer = { id: "buyer-1", role: "buyer" } as AppUser;

test("leaderboard returns names and ranks while keeping other buyers' purchase totals private", async () => {
  const prisma = { $queryRaw: async () => [
    { buyer_id: "buyer-2", full_name: "Sara Ahmadi", place: 1n, score: 240n, spent: { toString: () => "200000" }, quantity: 4n, order_count: 2n },
    { buyer_id: "buyer-1", full_name: "Ali Rezaei", place: 21n, score: 70n, spent: { toString: () => "50000" }, quantity: 2n, order_count: 1n }
  ] } as unknown as PrismaService;
  const result = await new LeaderboardService(prisma).get(buyer);
  assert.equal(result.leaders.length, 1);
  assert.equal(result.you.place, 21);
  assert.equal(result.you.spent, "50000");
  assert.equal(result.you.quantity, 2);
  assert.equal(result.you.score, "70");
  assert.equal(result.leaders[0]?.isYou, false);
  assert.equal(result.leaders[0]?.name, "Sara Ahmadi");
  assert.deepEqual(Object.keys(result.leaders[0]!).sort(), ["isYou", "name", "place", "score"]);
});

test("leaderboard refuses non-buyers before querying purchases", async () => {
  const prisma = { $queryRaw: () => { throw new Error("query should not run"); } } as unknown as PrismaService;
  await assert.rejects(() => new LeaderboardService(prisma).get({ ...buyer, role: "seller-admin" } as AppUser), ForbiddenException);
});
