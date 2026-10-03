import { strict as assert } from "node:assert";
import { createHmac } from "node:crypto";
import { it } from "node:test";
import { ConfigService } from "@nestjs/config";
import type { PrismaService } from "../../prisma/prisma.service";
import type { SmsRulesService } from "./sms-rules.service";
import { GuestCommentVerificationService } from "./guest-comment-verification.service";

it("consumes a guest comment code only once", async () => {
  const secret = "guest-comment-otp-secret-is-long-enough";
  const id = "f806cf78-26be-4f9b-bf5a-a0f118b9bac8";
  const phone = "+989121234567";
  const code = "123456";
  let consumed = false;
  const challenge = { id, phone, status: "pending", attempts: 0, expires_at: new Date(Date.now() + 60_000), code_hash: createHmac("sha256", secret).update(`guest-comment:${id}:${phone}:${code}`).digest("hex") };
  const prisma = { sms_guest_challenges: {
    findFirst: async () => consumed ? null : challenge,
    updateMany: async () => { consumed = true; return { count: 1 }; }
  } } as unknown as PrismaService;
  const service = new GuestCommentVerificationService(prisma, new ConfigService({ OTP_HMAC_KEY: secret }), {} as SmsRulesService);
  await service.consume(id, "09121234567", code);
  await assert.rejects(() => service.consume(id, phone, code), /invalid or expired/);
});
