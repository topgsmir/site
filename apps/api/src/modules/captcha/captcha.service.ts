import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { createHash, randomBytes, randomInt, randomUUID } from "node:crypto";
import { Prisma } from "../../prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

const ACTION_PATTERN = /^[A-Za-z0-9_-]{1,32}$/;
const TOKEN_PATTERN = /^([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\.([0-9]{1,10})$/i;
const DIFFICULTY = 17;
const TTL_MS = 2 * 60 * 1000;

@Injectable()
export class CaptchaService {
  constructor(private readonly prisma: PrismaService) {}

  async createChallenge(action: string) {
    if (!ACTION_PATTERN.test(action)) throw new BadRequestException("Invalid captcha action");
    const id = randomUUID();
    const nonce = randomBytes(16).toString("hex");
    const expiresAt = new Date(Date.now() + TTL_MS);
    await this.prisma.captcha_challenges.create({
      data: { id, action, nonce, difficulty: DIFFICULTY, expires_at: expiresAt }
    });
    if (randomInt(64) === 0) await this.pruneExpired();
    return { id, nonce, difficulty: DIFFICULTY, expiresAt: expiresAt.toISOString() };
  }

  /** Consume a challenge once, then check its answer before the protected operation. */
  async verify(token: string, expectedAction: string): Promise<void> {
    if (!ACTION_PATTERN.test(expectedAction)) throw new Error("Invalid captcha action configuration");
    const match = typeof token === "string" ? TOKEN_PATTERN.exec(token) : null;
    if (!match) throw new BadRequestException("Invalid captcha token");
    const solution = Number(match[2]);
    if (!Number.isSafeInteger(solution) || solution > 0xffffffff) {
      throw new BadRequestException("Invalid captcha token");
    }

    const challenge = await this.prisma.captcha_challenges.findUnique({
      where: { id: match[1] },
      select: { id: true, nonce: true, action: true, difficulty: true }
    });
    if (!challenge || challenge.action !== expectedAction) {
      throw new ForbiddenException("Captcha verification failed");
    }
    const consumed = await this.prisma.captcha_challenges.updateMany({
      where: {
        id: challenge.id,
        action: expectedAction,
        consumed_at: null,
        expires_at: { gt: new Date() }
      },
      data: { consumed_at: new Date() }
    });
    if (consumed.count !== 1 || !this.hasLeadingZeroBits(challenge.id, challenge.nonce, solution, challenge.difficulty)) {
      throw new ForbiddenException("Captcha verification failed");
    }
  }

  private hasLeadingZeroBits(id: string, nonce: string, solution: number, difficulty: number) {
    const hash = createHash("sha256").update(`${id}:${nonce}:${solution}`).digest();
    const wholeBytes = Math.floor(difficulty / 8);
    for (let index = 0; index < wholeBytes; index++) if (hash[index] !== 0) return false;
    const remainingBits = difficulty % 8;
    return !remainingBits || (hash[wholeBytes] >> (8 - remainingBits)) === 0;
  }

  private async pruneExpired() {
    await this.prisma.$executeRaw(Prisma.sql`
      DELETE FROM "captcha_challenges" WHERE "id" IN (
        SELECT "id" FROM "captcha_challenges"
        WHERE "expires_at" < CURRENT_TIMESTAMP - INTERVAL '1 day'
        ORDER BY "expires_at" LIMIT 500
      )
    `);
  }
}
