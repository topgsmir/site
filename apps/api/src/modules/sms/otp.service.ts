import { BadRequestException, ConflictException, Injectable, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import { createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { AuthService } from "../auth/auth.service";
import type { VerifyOtpDto } from "./dto/otp.dto";
import { normalizeIranianPhone } from "./phone-number";
import { SmsService } from "./sms.service";

@Injectable()
export class OtpService {
  constructor(private readonly prisma: PrismaService, private readonly auth: AuthService, private readonly sms: SmsService, private readonly config: ConfigService) {}

  async request(rawPhone: string) {
    const phone = normalizeIranianPhone(rawPhone);
    const id = randomUUID();
    const code = String(randomInt(0, 1_000_000)).padStart(6, "0");
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await this.prisma.otp_challenges.create({ data: { id, phone_number: phone, code_hash: this.hash(id, phone, code), expires_at: expiresAt } });
    await this.sms.enqueue(phone, "otp", { code }, `otp:${id}`);
    return {
      challengeId: id,
      expiresAt: expiresAt.toISOString(),
      ...((this.config.get<string>("NODE_ENV") ?? "development") === "development" ? { developmentCode: code } : {})
    };
  }

  async verify(input: VerifyOtpDto) {
    const phone = normalizeIranianPhone(input.phoneNumber);
    const challenge = await this.prisma.otp_challenges.findFirst({ where: { id: input.challengeId, phone_number: phone, status: "pending" } });
    if (!challenge || challenge.expires_at <= new Date() || challenge.attempts >= 5) throw new UnauthorizedException("OTP challenge is invalid or expired");
    const expected = Buffer.from(challenge.code_hash, "hex");
    const actual = Buffer.from(this.hash(challenge.id, phone, input.code), "hex");
    if (!timingSafeEqual(expected, actual)) {
      await this.prisma.otp_challenges.update({ where: { id: challenge.id }, data: { attempts: { increment: 1 } } });
      throw new UnauthorizedException("OTP code is incorrect");
    }

    const userId = await this.prisma.$transaction(async (transaction) => {
      const consumed = await transaction.otp_challenges.updateMany({
        where: { id: challenge.id, status: "pending", expires_at: { gt: new Date() }, attempts: { lt: 5 } },
        data: { status: "consumed", consumed_at: new Date() }
      });
      if (consumed.count !== 1) throw new ConflictException("OTP challenge was already used");
      const byPhone = await transaction.users.findUnique({ where: { phone_number: phone } });
      const email = input.email?.trim().toLowerCase();
      if (byPhone) {
        if (byPhone.role !== "buyer") throw new ConflictException("This phone number cannot be used for buyer checkout");
        if (email && email !== byPhone.email) {
          const owner = await transaction.users.findUnique({ where: { email } });
          if (owner && owner.id !== byPhone.id) throw new ConflictException("Email belongs to another account; use account recovery");
          throw new ConflictException("Email does not match this buyer account");
        }
        return byPhone.id;
      }
      if (!input.fullName || !email) throw new BadRequestException("Full name and email are required for a new buyer");
      const byEmail = await transaction.users.findUnique({ where: { email } });
      if (byEmail) throw new ConflictException("Email belongs to another account; use account recovery");
      const user = await transaction.users.create({ data: { full_name: input.fullName.trim(), email, phone_number: phone, role: "buyer" } });
      return user.id;
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return this.auth.createSessionForUser(userId);
  }

  private hash(id: string, phone: string, code: string) {
    const secret = this.config.get<string>("OTP_HMAC_KEY")?.trim();
    if (!secret || secret.length < 32) throw new ServiceUnavailableException("OTP security key is not configured");
    return createHmac("sha256", secret).update(`${id}:${phone}:${code}`).digest("hex");
  }
}
