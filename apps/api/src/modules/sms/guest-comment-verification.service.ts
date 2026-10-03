import { ForbiddenException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { normalizeIranianPhone } from "./phone-number";
import { SmsRulesService } from "./sms-rules.service";

@Injectable()
export class GuestCommentVerificationService {
  constructor(private readonly prisma: PrismaService, private readonly config: ConfigService, private readonly rules: SmsRulesService) {}

  enabled() { return this.rules.enabled("guest_comment_verification"); }

  async request(rawPhone: string) {
    if (!(await this.enabled())) throw new ServiceUnavailableException("Guest comment SMS verification is disabled");
    const phone = normalizeIranianPhone(rawPhone);
    const id = randomUUID();
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const expires = new Date(Date.now() + 5 * 60_000);
    await this.prisma.sms_guest_challenges.create({ data: { id, phone, code_hash: this.hash(id, phone, code), expires_at: expires } });
    await this.rules.dispatch("guest_comment_verification", { id, requesterPhone: phone, parameters: { code } });
    return { challengeId: id, expiresAt: expires.toISOString() };
  }

  async consume(id: string, rawPhone: string, code: string) {
    const phone = normalizeIranianPhone(rawPhone);
    const challenge = await this.prisma.sms_guest_challenges.findFirst({ where: { id, phone, status: "pending", expires_at: { gt: new Date() }, attempts: { lt: 5 } } });
    if (!challenge) throw new ForbiddenException("Verification code is invalid or expired");
    const expected = Buffer.from(challenge.code_hash, "hex");
    const actual = Buffer.from(this.hash(id, phone, code), "hex");
    if (!timingSafeEqual(expected, actual)) {
      await this.prisma.sms_guest_challenges.updateMany({ where: { id, status: "pending", attempts: { lt: 5 } }, data: { attempts: { increment: 1 } } });
      throw new ForbiddenException("Verification code is invalid or expired");
    }
    const updated = await this.prisma.sms_guest_challenges.updateMany({ where: { id, phone, status: "pending", expires_at: { gt: new Date() }, attempts: { lt: 5 } }, data: { status: "consumed" } });
    if (updated.count !== 1) throw new ForbiddenException("Verification code was already used");
  }

  private hash(id: string, phone: string, code: string) {
    const secret = this.config.get<string>("OTP_HMAC_KEY")?.trim();
    if (!secret || secret.length < 32) throw new ServiceUnavailableException("OTP security key is not configured");
    return createHmac("sha256", secret).update(`guest-comment:${id}:${phone}:${code}`).digest("hex");
  }
}
