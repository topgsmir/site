import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { it } from "node:test";
import type { PrismaService } from "../../prisma/prisma.service";
import { CaptchaService } from "./captcha.service";

function fixture() {
  let row: {
    id: string;
    nonce: string;
    action: string;
    difficulty: number;
    expires_at: Date;
    consumed_at: Date | null;
  } | null = null;
  const prisma = {
    captcha_challenges: {
      create: async ({ data }: { data: NonNullable<typeof row> }) => { row = { ...data, consumed_at: null }; },
      findUnique: async () => row,
      updateMany: async ({ where }: { where: { id: string; action: string } }) => {
        if (!row || row.id !== where.id || row.action !== where.action || row.consumed_at || row.expires_at <= new Date()) return { count: 0 };
        row.consumed_at = new Date();
        return { count: 1 };
      }
    },
    $executeRaw: async () => 0
  } as unknown as PrismaService;
  return { service: new CaptchaService(prisma), getRow: () => row };
}

function solve(id: string, nonce: string, difficulty: number) {
  for (let answer = 0; answer <= 0xffffffff; answer++) {
    const digest = createHash("sha256").update(`${id}:${nonce}:${answer}`).digest();
    const bytes = Math.floor(difficulty / 8);
    if (digest.subarray(0, bytes).some((value) => value !== 0)) continue;
    if (difficulty % 8 && (digest[bytes] >> (8 - difficulty % 8)) !== 0) continue;
    return answer;
  }
  throw new Error("No answer found");
}

it("issues and accepts a local single-use challenge", async () => {
  const { service } = fixture();
  const challenge = await service.createChallenge("checkout");
  const answer = solve(challenge.id, challenge.nonce, challenge.difficulty);
  const token = `${challenge.id}.${answer}`;
  await service.verify(token, "checkout");
  await assert.rejects(service.verify(token, "checkout"), { status: 403 });
});

it("rejects wrong action and malformed answers", async () => {
  const { service } = fixture();
  const challenge = await service.createChallenge("checkout");
  await assert.rejects(service.verify(`${challenge.id}.1`, "login"), { status: 403 });
  await assert.rejects(service.verify("bad-token", "checkout"), { status: 400 });
  await assert.rejects(service.createChallenge("invalid action"), { status: 400 });
});

it("consumes an invalid answer so guesses cannot be replayed", async () => {
  const { service, getRow } = fixture();
  const challenge = await service.createChallenge("checkout");
  const answer = solve(challenge.id, challenge.nonce, challenge.difficulty);
  const wrong = answer === 0 ? 1 : 0;
  await assert.rejects(service.verify(`${challenge.id}.${wrong}`, "checkout"), { status: 403 });
  assert.ok(getRow()?.consumed_at);
  await assert.rejects(service.verify(`${challenge.id}.${answer}`, "checkout"), { status: 403 });
});
