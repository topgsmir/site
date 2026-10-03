import { ConflictException, Injectable, Optional, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "../../prisma/client";
import { createHmac, randomInt, randomUUID, timingSafeEqual } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { AuthService } from "../auth/auth.service";
import { AuthLoginSettingsService } from "../auth/auth-login-settings.service";
import type { ConfirmPendingPhoneDto, VerifyOtpDto } from "./dto/otp.dto";
import { normalizeIranianPhone } from "./phone-number";
import { SmsService } from "./sms.service";
import { SmsSettingsService } from "./sms-settings.service";
import { ClubService } from "../club/club.service";
import type { AppUser } from "@topgsm/shared-types";

@Injectable()
export class OtpService {
  constructor(private readonly prisma: PrismaService, private readonly auth: AuthService, private readonly sms: SmsService, private readonly config: ConfigService, private readonly settings: SmsSettingsService, private readonly loginSettings: AuthLoginSettingsService, @Optional() private readonly club?: ClubService) {}

  async request(rawPhone: string) {
    await this.assertEnabled();
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
    await this.assertEnabled();
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
      const byPhone = await transaction.users.findUnique({ where: { phone_number: phone } });
      if (!byPhone && await transaction.users.findUnique({ where: { pending_phone_number: phone }, select: { id: true } })) {
        throw new UnauthorizedException("Phone number unavailable");
      }
      const email = input.email?.trim().toLowerCase();
      if (byPhone) {
        if (byPhone.account_status !== "active") throw new UnauthorizedException("Account unavailable");
        if (byPhone.role !== "buyer") throw new ConflictException("This phone number cannot be used for buyer checkout");
        if (email && email !== byPhone.email) {
          const owner = await transaction.users.findUnique({ where: { email } });
          if (owner && owner.id !== byPhone.id) throw new ConflictException("Email belongs to another account; use account recovery");
          throw new ConflictException("Email does not match this buyer account");
        }
      } else {
        if (!input.fullName?.trim()) return { kind: "registration-required" as const };
        if (email) {
          const byEmail = await transaction.users.findUnique({ where: { email } });
          if (byEmail) throw new ConflictException("Email belongs to another account; use account recovery");
        }
      }
      const consumed = await transaction.otp_challenges.updateMany({
        where: { id: challenge.id, status: "pending", expires_at: { gt: new Date() }, attempts: { lt: 5 } },
        data: { status: "consumed", consumed_at: new Date() }
      });
      if (consumed.count !== 1) throw new ConflictException("OTP challenge was already used");
      if (byPhone) return { kind: "user" as const, userId: byPhone.id };
      const user = await transaction.users.create({ data: { full_name: input.fullName!.trim(), email: email ?? null, phone_number: phone, role: "buyer" } });
      if (this.club) {
        const clubSettings = await transaction.club_settings.findUnique({ where: { id: 1 } });
        if (clubSettings?.enabled && clubSettings.signup_points > 0) await this.club.award(transaction, user.id, clubSettings.signup_points, `club-signup:${user.id}`, "signup", user.id);
      }
      return { kind: "user" as const, userId: user.id };
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    if (userId.kind === "registration-required") return { registrationRequired: true as const };
    return this.auth.createSessionForUser(userId.userId);
  }

  private hash(id: string, phone: string, code: string) {
    const secret = this.config.get<string>("OTP_HMAC_KEY")?.trim();
    if (!secret || secret.length < 32) throw new ServiceUnavailableException("OTP security key is not configured");
    return createHmac("sha256", secret).update(`${id}:${phone}:${code}`).digest("hex");
  }

  async pendingPhone(actor: AppUser) {
    if (actor.role !== "buyer") throw new UnauthorizedException("Buyer account required");
    const user = await this.prisma.users.findUnique({ where: { id: actor.id }, select: { pending_phone_number: true } });
    return { pendingPhoneNumber: user?.pending_phone_number ?? null };
  }

  async confirmPendingPhone(actor: AppUser, input: ConfirmPendingPhoneDto) {
    if (actor.role !== "buyer") throw new UnauthorizedException("Buyer account required");
    await this.assertEnabled();
    const phone = normalizeIranianPhone(input.phoneNumber);
    const challenge = await this.prisma.otp_challenges.findFirst({ where: { id: input.challengeId, phone_number: phone, status: "pending" } });
    if (!challenge || challenge.expires_at <= new Date() || challenge.attempts >= 5) throw new UnauthorizedException("OTP challenge is invalid or expired");
    const expected = Buffer.from(challenge.code_hash, "hex");
    const actual = Buffer.from(this.hash(challenge.id, phone, input.code), "hex");
    if (!timingSafeEqual(expected, actual)) {
      await this.prisma.otp_challenges.update({ where: { id: challenge.id }, data: { attempts: { increment: 1 } } });
      throw new UnauthorizedException("OTP code is incorrect");
    }
    await this.prisma.$transaction(async (transaction) => {
      const owner = await transaction.users.findUnique({ where: { id: actor.id }, select: { role: true, account_status: true, pending_phone_number: true } });
      if (!owner || owner.role !== "buyer" || owner.account_status !== "active" || owner.pending_phone_number !== phone) throw new UnauthorizedException("Phone number unavailable");
      const other = await transaction.users.findFirst({ where: { id: { not: actor.id }, phone_number: phone }, select: { id: true } });
      if (other) throw new ConflictException("Phone number is already in use");
      const consumed = await transaction.otp_challenges.updateMany({ where: { id: challenge.id, status: "pending", expires_at: { gt: new Date() }, attempts: { lt: 5 } }, data: { status: "consumed", consumed_at: new Date() } });
      if (consumed.count !== 1) throw new ConflictException("OTP challenge was already used");
      const promoted = await transaction.users.updateMany({ where: { id: actor.id, pending_phone_number: phone, account_status: "active" }, data: { phone_number: phone, pending_phone_number: null } });
      if (promoted.count !== 1) throw new ConflictException("Phone number changed; request a new code");
    }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
    return { phoneNumber: phone };
  }

  private async assertEnabled() {
    await this.loginSettings.assertPhoneOtpEnabled();
    if (!(await this.settings.isOtpEnabled())) {
      throw new ServiceUnavailableException("OTP sign-in is currently disabled");
    }
  }
}
