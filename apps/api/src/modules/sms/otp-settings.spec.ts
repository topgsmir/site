import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { ConfigService } from "@nestjs/config";
import type { PrismaService } from "../../prisma/prisma.service";
import type { AuthService } from "../auth/auth.service";
import type { AuthLoginSettingsService } from "../auth/auth-login-settings.service";
import { OtpService } from "./otp.service";
import type { SmsService } from "./sms.service";
import type { SmsSettingsService } from "./sms-settings.service";

describe("OtpService SMS settings", () => {
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
});
