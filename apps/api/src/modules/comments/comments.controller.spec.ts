import { strict as assert } from "node:assert";
import { it } from "node:test";
import type { AuthService } from "../auth/auth.service";
import type { AuthRateLimitService } from "../auth/auth-rate-limit.service";
import type { SecurityPolicyService } from "../auth/security-policy.service";
import type { CaptchaService } from "../captcha/captcha.service";
import type { AuthenticatedRequest } from "../auth/platform-admin.guard";
import type { CommentsService } from "./comments.service";
import { CommentsController } from "./comments.controller";

it("rate-limits a guest submission before creating a comment", async () => {
  const calls: string[] = [];
  const comments = { create: async (target: string) => { calls.push(`create:${target}`); return { id: "comment", status: "pending" }; } } as unknown as CommentsService;
  const limits = { consumeCommentSubmit: async (_userId: string | null, target: string) => { calls.push(`limit:${target}`); } } as unknown as AuthRateLimitService;
  const policies = { get: async () => ({ captchaEnabled: false }) } as unknown as SecurityPolicyService;
  const controller = new CommentsController(comments, {} as AuthService, limits, policies, {} as CaptchaService);
  const request = { headers: {} } as AuthenticatedRequest;
  await controller.create("product-1", { body: "Question", guestName: "Guest" }, request, "127.0.0.1");
  await controller.createBlog("post-1", { body: "Article question", guestName: "Guest" }, request, "127.0.0.1");
  assert.deepEqual(calls, ["limit:product:product-1", "create:product", "limit:blog:post-1", "create:blog"]);
});
