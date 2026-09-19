import assert from "node:assert/strict";
import { it } from "node:test";
import type { ConfigService } from "@nestjs/config";
import type { AuthRateLimitService } from "./auth-rate-limit.service";
import type { SecurityPolicyService } from "./security-policy.service";
import type { CaptchaService } from "../captcha/captcha.service";
import { OtpController } from "../sms/otp.controller";
import type { OtpService } from "../sms/otp.service";
import { CommentsController } from "../comments/comments.controller";
import type { CommentsService } from "../comments/comments.service";
import type { AuthService } from "./auth.service";
import type { AuthenticatedRequest } from "./platform-admin.guard";

it("requires CAPTCHA before requesting an SMS code when enabled", async () => {
  const calls: string[] = [];
  const otp = { request: async () => { calls.push("otp"); return { challengeId: "challenge" }; } } as unknown as OtpService;
  const limits = { consumeOtp: async () => { calls.push("limit"); } } as unknown as AuthRateLimitService;
  const policies = { get: async () => ({ captchaEnabled: true }) } as unknown as SecurityPolicyService;
  const captcha = { verify: async () => { calls.push("captcha"); } } as unknown as CaptchaService;
  const controller = new OtpController(otp, limits, {} as ConfigService, policies, captcha);
  await assert.rejects(() => controller.request({ phoneNumber: "09123456789" }, "127.0.0.1"), { status: 403 });
  assert.deepEqual(calls, ["limit"]);
  await controller.request({ phoneNumber: "09123456789", captchaToken: "token" }, "127.0.0.1");
  assert.deepEqual(calls, ["limit", "limit", "captcha", "otp"]);
});

it("requires CAPTCHA before creating a guest comment when enabled", async () => {
  const calls: string[] = [];
  const comments = { create: async () => { calls.push("create"); return { status: "pending" }; } } as unknown as CommentsService;
  const auth = {} as AuthService;
  const limits = { consumeCommentSubmit: async () => { calls.push("limit"); } } as unknown as AuthRateLimitService;
  const policies = { get: async () => ({ captchaEnabled: true }) } as unknown as SecurityPolicyService;
  const captcha = { verify: async () => { calls.push("captcha"); } } as unknown as CaptchaService;
  const controller = new CommentsController(comments, auth, limits, policies, captcha);
  const request = { headers: {} } as AuthenticatedRequest;
  await assert.rejects(() => controller.create("product-id", { body: "Hello", guestName: "Guest" }, request, "127.0.0.1"), { status: 403 });
  assert.deepEqual(calls, ["limit"]);
  await controller.create("product-id", { body: "Hello", guestName: "Guest", captchaToken: "token" }, request, "127.0.0.1");
  assert.deepEqual(calls, ["limit", "limit", "captcha", "create"]);
});
