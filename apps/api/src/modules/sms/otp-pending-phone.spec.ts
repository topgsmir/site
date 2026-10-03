import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { ConfigService } from "@nestjs/config";
import { UnauthorizedException } from "@nestjs/common";
import type { AppUser } from "@topgsm/shared-types";
import type { PrismaService } from "../../prisma/prisma.service";
import type { AuthService } from "../auth/auth.service";
import type { AuthLoginSettingsService } from "../auth/auth-login-settings.service";
import type { SmsService } from "./sms.service";
import type { SmsSettingsService } from "./sms-settings.service";
import { OtpService } from "./otp.service";

const actor: AppUser = { id: "buyer-1", fullName: "Buyer", email: "buyer@example.com", role: "buyer" };
const phone = "+989121234567";

describe("pending buyer phone verification", () => {
  it("issues a challenge, refuses public login, and promotes only after authenticated proof", async () => {
    let challengeData: Record<string, unknown> | undefined;
    let challengeStatus = "pending";
    let activePhone: string | null = null;
    let pendingPhone: string | null = phone;
    const prisma = {
      users: { findUnique: async () => ({ pending_phone_number: pendingPhone }) },
      otp_challenges: {
        create: async ({ data }: { data: Record<string, unknown> }) => { challengeData = data; },
        findFirst: async ({ where }: { where: Record<string, unknown> }) =>
          where.id === challengeData?.id && where.phone_number === phone && challengeStatus === "pending"
            ? { ...challengeData, status: challengeStatus, attempts: 0 } : null
      },
      $transaction: async (callback: (tx: unknown) => Promise<unknown>) => callback({
        users: {
          findUnique: async ({ where }: { where: Record<string, unknown> }) =>
            where.phone_number ? null : where.pending_phone_number ? { id: actor.id } : { role: "buyer", account_status: "active", pending_phone_number: pendingPhone },
          findFirst: async () => null,
          updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) => {
            assert.equal(where.id, actor.id);
            assert.equal(where.pending_phone_number, phone);
            activePhone = data.phone_number as string;
            pendingPhone = data.pending_phone_number as null;
            return { count: 1 };
          }
        },
        otp_challenges: { updateMany: async () => { challengeStatus = "consumed"; return { count: 1 }; } }
      })
    } as unknown as PrismaService;
    const service = new OtpService(
      prisma,
      {} as AuthService,
      { enqueue: async () => undefined } as unknown as SmsService,
      { get: (key: string) => key === "OTP_HMAC_KEY" ? "a-secret-long-enough-for-otp-hmac-testing" : "development" } as ConfigService,
      { isOtpEnabled: async () => true } as SmsSettingsService,
      { assertPhoneOtpEnabled: async () => undefined } as unknown as AuthLoginSettingsService
    );
    assert.deepEqual(await service.pendingPhone(actor), { pendingPhoneNumber: phone });
    const issued = await service.request(phone);
    const input = { challengeId: issued.challengeId, phoneNumber: phone, code: issued.developmentCode! };
    await assert.rejects(service.verify(input), UnauthorizedException);
    assert.equal(challengeStatus, "pending");
    assert.deepEqual(await service.confirmPendingPhone(actor, input), { phoneNumber: phone });
    assert.equal(activePhone, phone);
    assert.equal(pendingPhone, null);
    assert.equal(challengeStatus, "consumed");
    await assert.rejects(service.confirmPendingPhone(actor, input), UnauthorizedException);
  });
});
