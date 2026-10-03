import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";
import type { PrismaService } from "../../prisma/prisma.service";
import { normalizeIranianPhone } from "./phone-number";
import { OtpService } from "./otp.service";

test("buyer checkout OTP cannot sign in a staff account, including a promoted buyer", async () => {
  const phoneNumber = "09123456789";
  const normalized = normalizeIranianPhone(phoneNumber);
  const challengeId = "challenge-1";
  const code = "123456";
  const secret = "test-secret-with-at-least-thirty-two-characters";
  const codeHash = createHmac("sha256", secret).update(`${challengeId}:${normalized}:${code}`).digest("hex");
  for (const role of ["seller_admin", "seller_staff", "platform_admin", "platform_staff"]) {
    const transaction = {
      users: { findUnique: async () => ({ id: "promoted-buyer", role, account_status: "active" }) },
      otp_challenges: { updateMany: () => { throw new Error("staff OTP must not be consumed"); } }
    };
    const prisma = {
      otp_challenges: { findFirst: async () => ({ id: challengeId, code_hash: codeHash, expires_at: new Date(Date.now() + 60_000), attempts: 0 }) },
      $transaction: async (work: (tx: typeof transaction) => Promise<unknown>) => work(transaction)
    } as unknown as PrismaService;
    const service = new OtpService(
      prisma, { createSessionForUser: () => { throw new Error("staff OTP must not create a session"); } } as never,
      {} as never, { get: () => secret } as never,
      { isOtpEnabled: async () => true } as never,
      { assertPhoneOtpEnabled: async () => undefined } as never
    );
    await assert.rejects(() => service.verify({ challengeId, phoneNumber, code }), /cannot be used for buyer checkout/);
  }
});
