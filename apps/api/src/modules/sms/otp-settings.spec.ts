import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { createHmac } from "node:crypto";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import type { ConfigService } from "@nestjs/config";
import type { PrismaService } from "../../prisma/prisma.service";
import type { AuthService } from "../auth/auth.service";
import type { AuthLoginSettingsService } from "../auth/auth-login-settings.service";
import { OtpService } from "./otp.service";
import { VerifyOtpDto } from "./dto/otp.dto";
import type { SmsService } from "./sms.service";
import type { SmsSettingsService } from "./sms-settings.service";

describe("OtpService SMS settings", () => {
  it("accepts blank optional profile fields from an existing checkout client", async () => {
    const body = plainToInstance(VerifyOtpDto, {
      phoneNumber: "09927057081", challengeId: "00000000-0000-4000-8000-000000000001",
      code: "123456", fullName: "", email: ""
    });
    assert.deepEqual(await validate(body), []);
    assert.equal(body.fullName, undefined);
    assert.equal(body.email, undefined);
  });

  it("rejects phone sign-in before creating a challenge when the method is disabled", async () => {
    let challengeCreated = false;
    const service = new OtpService(
      { otp_challenges: { create: async () => { challengeCreated = true; } } } as unknown as PrismaService,
      {} as AuthService,
      {} as SmsService,
      {} as ConfigService,
      { isOtpEnabled: async () => true } as SmsSettingsService,
      { assertPhoneOtpEnabled: async () => { throw new Error("Phone sign-in is disabled"); } } as unknown as AuthLoginSettingsService
    );
    await assert.rejects(() => service.request("09121234567"), /disabled/);
    assert.equal(challengeCreated, false);
  });

  it("rejects OTP requests before creating a challenge when OTP is disabled", async () => {
    let challengeCreated = false;
    const prisma = {
      otp_challenges: { create: async () => { challengeCreated = true; } }
    } as unknown as PrismaService;
    const settings = { isOtpEnabled: async () => false } as SmsSettingsService;
    const service = new OtpService(
      prisma,
      {} as AuthService,
      {} as SmsService,
      {} as ConfigService,
      settings,
      { assertPhoneOtpEnabled: async () => undefined } as unknown as AuthLoginSettingsService
    );

    await assert.rejects(() => service.request("09121234567"), /currently disabled/i);
    assert.equal(challengeCreated, false);
  });

  it("rejects verification before reading a challenge when OTP is disabled", async () => {
    let challengeRead = false;
    const prisma = {
      otp_challenges: { findFirst: async () => { challengeRead = true; } }
    } as unknown as PrismaService;
    const service = new OtpService(
      prisma,
      {} as AuthService,
      {} as SmsService,
      {} as ConfigService,
      { isOtpEnabled: async () => false } as SmsSettingsService,
      { assertPhoneOtpEnabled: async () => undefined } as unknown as AuthLoginSettingsService
    );

    await assert.rejects(
      () => service.verify({
        phoneNumber: "09121234567",
        challengeId: "00000000-0000-4000-8000-000000000001",
        code: "123456"
      }),
      /currently disabled/i
    );
    assert.equal(challengeRead, false);
  });

  it("keeps a valid challenge available when a new buyer omits registration details", async () => {
    const challengeId = "00000000-0000-4000-8000-000000000001";
    const phone = "+989121234567";
    const code = "123456";
    const secret = "a-secret-long-enough-for-otp-hmac-testing";
    const challenge = {
      id: challengeId, phone_number: phone, status: "pending", attempts: 0,
      expires_at: new Date(Date.now() + 60_000),
      code_hash: createHmac("sha256", secret).update(`${challengeId}:${phone}:${code}`).digest("hex")
    };
    let consumed = 0;
    let createdBuyer: Record<string, unknown> | undefined;
    const tx = {
      users: { findUnique: async () => null, create: async ({ data }: { data: Record<string, unknown> }) => { createdBuyer = data; return { id: "new-buyer" }; } },
      otp_challenges: { updateMany: async () => { consumed++; return { count: 1 }; } }
    };
    const prisma = {
      otp_challenges: { findFirst: async () => challenge },
      $transaction: async (callback: (value: typeof tx) => unknown) => callback(tx)
    } as unknown as PrismaService;
    const service = new OtpService(
      prisma,
      { createSessionForUser: async (id: string) => ({ userId: id }) } as unknown as AuthService,
      {} as SmsService,
      { get: () => secret } as unknown as ConfigService,
      { isOtpEnabled: async () => true } as SmsSettingsService,
      { assertPhoneOtpEnabled: async () => undefined } as unknown as AuthLoginSettingsService
    );
    const input = { phoneNumber: "09121234567", challengeId, code };
    await assert.rejects(() => service.verify(input), /Name is required/);
    assert.equal(consumed, 0);
    assert.deepEqual(await service.verify({ ...input, fullName: "Buyer" }), { userId: "new-buyer" });
    assert.equal(createdBuyer?.email, null);
    assert.equal(consumed, 1);
  });
});
