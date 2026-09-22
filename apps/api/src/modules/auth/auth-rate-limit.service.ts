import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { Prisma } from "../../prisma/client";
import { createHash } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { SecurityPolicyService } from "./security-policy.service";
import type { SecurityAction } from "./security-policy.service";

type RateLimitResult = {
  attempt_count: number;
  blocked_until: Date | null;
};

type Bucket = {
  action: string;
  scope: string;
  value: string;
  limit: number;
  windowSeconds: number;
  blockSeconds: number;
};

@Injectable()
export class AuthRateLimitService {
  constructor(private readonly prisma: PrismaService, private readonly policies: SecurityPolicyService) {}

  async consumeLogin(identifier: string, clientIp: string) {
    const policy = await this.policies.get("login");
    await this.consume({
      action: "login",
      scope: "ip",
      value: this.normalizeIp(clientIp),
      limit: policy.ipLimit,
      windowSeconds: policy.ipWindowSeconds,
      blockSeconds: policy.ipWindowSeconds
    });
    await this.consume({
      action: "login",
      scope: "account",
      value: identifier.trim().toLowerCase(),
      limit: policy.subjectLimit,
      windowSeconds: policy.subjectWindowSeconds,
      blockSeconds: policy.subjectWindowSeconds
    });
    await this.pruneStaleBuckets();
  }

  async clearSuccessfulLogin(identifier: string) {
    await this.prisma.auth_rate_limits.deleteMany({
      where: {
        key_hash: this.keyHash(
          "login",
          "account",
          identifier.trim().toLowerCase()
        )
      }
    });
  }

  async consumeRegistration(email: string, clientIp: string) {
    const policy = await this.policies.get("register");
    await this.consume({
      action: "register",
      scope: "ip",
      value: this.normalizeIp(clientIp),
      limit: policy.ipLimit,
      windowSeconds: policy.ipWindowSeconds,
      blockSeconds: policy.ipWindowSeconds
    });
    await this.consume({
      action: "register",
      scope: "email",
      value: email.trim().toLowerCase(),
      limit: policy.subjectLimit,
      windowSeconds: policy.subjectWindowSeconds,
      blockSeconds: policy.subjectWindowSeconds
    });
    await this.pruneStaleBuckets();
  }

  async consumeCaptchaChallenge(clientIp: string) {
    const policy = await this.policies.get("captcha_challenge");
    await this.consume({
      action: "captcha_challenge",
      scope: "ip",
      value: this.normalizeIp(clientIp),
      limit: policy.ipLimit,
      windowSeconds: policy.ipWindowSeconds,
      blockSeconds: policy.ipWindowSeconds
    });
  }

  async consumeProfileMutation(userId: string, clientIp: string) {
    await this.consume({
      action: "profile",
      scope: "ip",
      value: this.normalizeIp(clientIp),
      limit: 30,
      windowSeconds: 900,
      blockSeconds: 900
    });
    await this.consume({
      action: "profile",
      scope: "account",
      value: userId,
      limit: 10,
      windowSeconds: 900,
      blockSeconds: 900
    });
    await this.pruneStaleBuckets();
  }

  async consumeOrderMutation(userId: string, clientIp: string) {
    await this.consumeSensitiveMutation("order", userId, clientIp);
  }

  async consumeShippingMutation(userId: string, clientIp: string) {
    await this.consumeSensitiveMutation("shipping", userId, clientIp);
  }

  async consumeShippingConfiguration(userId: string, clientIp: string) {
    await this.consumeSensitiveMutation("shipping_configuration", userId, clientIp);
  }

  async consumePayoutMutation(userId: string, clientIp: string) {
    await this.consumeSensitiveMutation("payout", userId, clientIp);
  }

  async consumeMediaUpload(userId: string, clientIp: string) {
    await this.consumeSensitiveMutation("media", userId, clientIp);
  }

  async consumeMediaAdmin(userId: string, clientIp: string) {
    await this.consumeSensitiveMutation("media_admin", userId, clientIp);
  }

  async consumeBackupAdmin(userId: string, clientIp: string) {
    await this.consumeSensitiveMutation("backup_admin", userId, clientIp);
  }

  async consumeBackupRestore(userId: string, clientIp: string) {
    await this.consumeSensitiveMutation("backup_restore", userId, clientIp);
  }

  async consumePaymentInitiation(userId: string, clientIp: string) {
    await this.consumeSensitiveMutation("payment", userId, clientIp);
  }

  async consumePaymentCallback(authority: string, clientIp: string) {
    await this.consumePublicOperation(
      "payment_callback",
      "authority",
      authority.trim(),
      clientIp
    );
  }

  async consumeCheckoutQuote(subject: string, clientIp: string) {
    await this.consumePublicOperation(
      "checkout_quote",
      "cart",
      subject,
      clientIp
    );
  }

  async consumePaymentRefund(userId: string, clientIp: string) {
    await this.consumeSensitiveMutation("payment_refund", userId, clientIp);
  }

  async consumePaymentConfiguration(userId: string, clientIp: string) {
    await this.consumeSensitiveMutation("payment_configuration", userId, clientIp);
  }

  async consumeSmsConfiguration(userId: string, clientIp: string) {
    await this.consumeSensitiveMutation("sms_configuration", userId, clientIp);
  }

  async consumeGoghdiConfiguration(userId: string, clientIp: string) {
    await this.consumeSensitiveMutation("goghdi_configuration", userId, clientIp);
  }

  async consumeAuthConfiguration(userId: string, clientIp: string) {
    await this.consumeSensitiveMutation("auth_configuration", userId, clientIp);
  }

  async consumeStaffSetup(token: string, clientIp: string) {
    await this.consumePublicOperation(
      "staff_setup",
      "token",
      token.trim(),
      clientIp
    );
  }

  async consumeBridgeOperation(userId: string, clientIp: string) {
    await this.consumeSensitiveMutation("bridge", userId, clientIp);
  }

  async consumeSignedTicket(userId: string, clientIp: string) {
    await this.consumeSensitiveMutation("signed_ticket", userId, clientIp);
  }

  async consumeAiProfile(userId: string, clientIp: string) {
    await this.consumeSensitiveMutation("ai_profile", userId, clientIp);
  }

  async consumeAiProfileTest(userId: string, clientIp: string) {
    await this.consumeSensitiveMutation("ai_profile_test", userId, clientIp);
  }

  async consumeAiRun(userId: string, clientIp: string) {
    await this.consumeSensitiveMutation("ai_run", userId, clientIp);
  }

  async consumeProductBulkUndo(userId: string, clientIp: string) {
    await this.consumeSensitiveMutation("product_bulk_undo", userId, clientIp);
  }

  async consumeCommentSubmit(userId: string | null, productId: string, clientIp: string) {
    if (userId) {
      await this.consumeSensitiveMutation("comment_submit", userId, clientIp);
    } else {
      await this.consumePublicOperation("comment_submit", "ip_product", `${this.normalizeIp(clientIp)}:${productId}`, clientIp, "comment_submit_guest");
    }
  }

  async consumeCommentReply(userId: string, clientIp: string) {
    await this.consumeSensitiveMutation("comment_reply", userId, clientIp);
  }

  async consumeCommentAdmin(userId: string, clientIp: string) {
    await this.consumeSensitiveMutation("comment_admin", userId, clientIp);
  }

  async consumeAnalyticsRead(userId: string, clientIp: string) {
    const policy = await this.policies.get("analytics");
    await this.consume({
      action: "analytics",
      scope: "ip",
      value: this.normalizeIp(clientIp),
      limit: policy.ipLimit,
      windowSeconds: policy.ipWindowSeconds,
      blockSeconds: policy.ipWindowSeconds
    });
    await this.consume({
      action: "analytics",
      scope: "account",
      value: userId,
      limit: policy.subjectLimit,
      windowSeconds: policy.subjectWindowSeconds,
      blockSeconds: policy.subjectWindowSeconds
    });
    await this.pruneStaleBuckets();
  }

  async consumeOtp(phoneNumber: string, clientIp: string) {
    const policy = await this.policies.get("otp");
    await this.consume({
      action: "otp",
      scope: "ip",
      value: this.normalizeIp(clientIp),
      limit: policy.ipLimit,
      windowSeconds: policy.ipWindowSeconds,
      blockSeconds: policy.ipWindowSeconds
    });
    await this.consume({
      action: "otp",
      scope: "phone",
      value: phoneNumber,
      limit: policy.subjectLimit,
      windowSeconds: policy.subjectWindowSeconds,
      blockSeconds: policy.subjectWindowSeconds
    });
  }

  private async consumeSensitiveMutation(
    action:
      | "order"
      | "shipping"
      | "shipping_configuration"
      | "payout"
      | "media"
      | "media_admin"
      | "payment"
      | "payment_refund"
      | "payment_configuration"
      | "sms_configuration"
      | "goghdi_configuration"
      | "auth_configuration"
      | "bridge"
      | "signed_ticket"
      | "ai_profile"
      | "ai_profile_test"
      | "ai_run"
      | "product_bulk_undo"
      | "comment_submit"
      | "comment_reply"
      | "comment_admin"
      | "backup_admin"
      | "backup_restore",
    userId: string,
    clientIp: string
  ) {
    const policy = await this.policies.get(action);
    await this.consume({
      action,
      scope: "ip",
      value: this.normalizeIp(clientIp),
      limit: policy.ipLimit,
      windowSeconds: policy.ipWindowSeconds,
      blockSeconds: policy.ipWindowSeconds
    });
    await this.consume({
      action,
      scope: "account",
      value: userId,
      limit: policy.subjectLimit,
      windowSeconds: policy.subjectWindowSeconds,
      blockSeconds: policy.subjectWindowSeconds
    });
    await this.pruneStaleBuckets();
  }

  private async consumePublicOperation(
    action: "payment_callback" | "staff_setup" | "checkout_quote" | "comment_submit",
    subjectScope: string,
    subjectValue: string,
    clientIp: string,
    policyAction: SecurityAction = action
  ) {
    const policy = await this.policies.get(policyAction);
    await this.consume({
      action,
      scope: "ip",
      value: this.normalizeIp(clientIp),
      limit: policy.ipLimit,
      windowSeconds: policy.ipWindowSeconds,
      blockSeconds: policy.ipWindowSeconds
    });
    await this.consume({
      action,
      scope: subjectScope,
      value: subjectValue,
      limit: policy.subjectLimit,
      windowSeconds: policy.subjectWindowSeconds,
      blockSeconds: policy.subjectWindowSeconds
    });
    await this.pruneStaleBuckets();
  }

  private async consume(bucket: Bucket) {
    const keyHash = this.keyHash(bucket.action, bucket.scope, bucket.value);
    const rows = await this.prisma.$queryRaw<RateLimitResult[]>(Prisma.sql`
      INSERT INTO "auth_rate_limits" (
        "key_hash", "action", "window_started_at", "attempt_count",
        "blocked_until", "updated_at"
      )
      VALUES (${keyHash}, ${bucket.action}, CURRENT_TIMESTAMP, 1, NULL, CURRENT_TIMESTAMP)
      ON CONFLICT ("key_hash") DO UPDATE SET
        "action" = EXCLUDED."action",
        "attempt_count" = CASE
          WHEN "auth_rate_limits"."window_started_at" <=
            CURRENT_TIMESTAMP - (${bucket.windowSeconds} * INTERVAL '1 second')
          THEN 1
          ELSE "auth_rate_limits"."attempt_count" + 1
        END,
        "window_started_at" = CASE
          WHEN "auth_rate_limits"."window_started_at" <=
            CURRENT_TIMESTAMP - (${bucket.windowSeconds} * INTERVAL '1 second')
          THEN CURRENT_TIMESTAMP
          ELSE "auth_rate_limits"."window_started_at"
        END,
        "blocked_until" = CASE
          WHEN "auth_rate_limits"."blocked_until" > CURRENT_TIMESTAMP
          THEN "auth_rate_limits"."blocked_until"
          WHEN "auth_rate_limits"."window_started_at" <=
            CURRENT_TIMESTAMP - (${bucket.windowSeconds} * INTERVAL '1 second')
          THEN NULL
          WHEN "auth_rate_limits"."attempt_count" + 1 > ${bucket.limit}
          THEN CURRENT_TIMESTAMP + (${bucket.blockSeconds} * INTERVAL '1 second')
          ELSE NULL
        END,
        "updated_at" = CURRENT_TIMESTAMP
      RETURNING "attempt_count", "blocked_until"
    `);
    const result = rows[0];

    if (result?.blocked_until && result.blocked_until.getTime() > Date.now()) {
      throw new HttpException(
        "Too many attempts. Try again later.",
        HttpStatus.TOO_MANY_REQUESTS
      );
    }
  }

  private keyHash(action: string, scope: string, value: string) {
    return createHash("sha256")
      .update(`${action}:${scope}:${value}`)
      .digest("hex");
  }

  private async pruneStaleBuckets() {
    await this.prisma.auth_rate_limits.deleteMany({
      where: {
        updated_at: { lt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000) }
      }
    });
  }

  private normalizeIp(clientIp: string) {
    const normalized = clientIp.trim().toLowerCase();
    return normalized.slice(0, 128) || "unknown";
  }
}
