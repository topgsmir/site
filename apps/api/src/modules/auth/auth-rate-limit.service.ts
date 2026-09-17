import { HttpException, HttpStatus, Injectable } from "@nestjs/common";
import { Prisma } from "../../prisma/client";
import { createHash } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service";

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
  constructor(private readonly prisma: PrismaService) {}

  async consumeLogin(identifier: string, clientIp: string) {
    await this.consume({
      action: "login",
      scope: "ip",
      value: this.normalizeIp(clientIp),
      limit: 40,
      windowSeconds: 15 * 60,
      blockSeconds: 15 * 60
    });
    await this.consume({
      action: "login",
      scope: "account",
      value: identifier.trim().toLowerCase(),
      limit: 8,
      windowSeconds: 15 * 60,
      blockSeconds: 15 * 60
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
    await this.consume({
      action: "register",
      scope: "ip",
      value: this.normalizeIp(clientIp),
      limit: 10,
      windowSeconds: 60 * 60,
      blockSeconds: 60 * 60
    });
    await this.consume({
      action: "register",
      scope: "email",
      value: email.trim().toLowerCase(),
      limit: 3,
      windowSeconds: 24 * 60 * 60,
      blockSeconds: 24 * 60 * 60
    });
    await this.pruneStaleBuckets();
  }

  async consumeOrderMutation(userId: string, clientIp: string) {
    await this.consumeSensitiveMutation("order", userId, clientIp, 30, 100);
  }

  async consumeShippingMutation(userId: string, clientIp: string) {
    await this.consumeSensitiveMutation("shipping", userId, clientIp, 10, 30);
  }

  async consumeShippingConfiguration(userId: string, clientIp: string) {
    await this.consumeSensitiveMutation("shipping_configuration", userId, clientIp, 10, 30);
  }

  async consumePayoutMutation(userId: string, clientIp: string) {
    await this.consumeSensitiveMutation("payout", userId, clientIp, 20, 60);
  }

  async consumeMediaUpload(userId: string, clientIp: string) {
    await this.consumeSensitiveMutation("media", userId, clientIp, 30, 90);
  }

  async consumePaymentInitiation(userId: string, clientIp: string) {
    await this.consumeSensitiveMutation("payment", userId, clientIp, 10, 40);
  }

  async consumePaymentCallback(authority: string, clientIp: string) {
    await this.consumePublicOperation(
      "payment_callback",
      "authority",
      authority.trim(),
      clientIp,
      10,
      60,
      15 * 60
    );
  }

  async consumeCheckoutQuote(subject: string, clientIp: string) {
    await this.consumePublicOperation(
      "checkout_quote",
      "cart",
      subject,
      clientIp,
      30,
      120,
      15 * 60
    );
  }

  async consumePaymentRefund(userId: string, clientIp: string) {
    await this.consumeSensitiveMutation("payment_refund", userId, clientIp, 10, 30);
  }

  async consumePaymentConfiguration(userId: string, clientIp: string) {
    await this.consumeSensitiveMutation("payment_configuration", userId, clientIp, 10, 30);
  }

  async consumeSmsConfiguration(userId: string, clientIp: string) {
    await this.consumeSensitiveMutation("sms_configuration", userId, clientIp, 10, 30);
  }

  async consumeStaffSetup(token: string, clientIp: string) {
    await this.consumePublicOperation(
      "staff_setup",
      "token",
      token.trim(),
      clientIp,
      10,
      30,
      60 * 60
    );
  }

  async consumeBridgeOperation(userId: string, clientIp: string) {
    await this.consumeSensitiveMutation("bridge", userId, clientIp, 20, 60);
  }

  async consumeSignedTicket(userId: string, clientIp: string) {
    await this.consumeSensitiveMutation("signed_ticket", userId, clientIp, 30, 90);
  }

  async consumeAiProfile(userId: string, clientIp: string) {
    await this.consumeSensitiveMutation("ai_profile", userId, clientIp, 10, 30);
  }

  async consumeAiProfileTest(userId: string, clientIp: string) {
    await this.consumeSensitiveMutation("ai_profile_test", userId, clientIp, 30, 90);
  }

  async consumeAiRun(userId: string, clientIp: string) {
    await this.consumeSensitiveMutation("ai_run", userId, clientIp, 20, 60);
  }

  async consumeProductBulkUndo(userId: string, clientIp: string) {
    await this.consumeSensitiveMutation("product_bulk_undo", userId, clientIp, 5, 15);
  }

  async consumeOtp(phoneNumber: string, clientIp: string) {
    await this.consume({
      action: "otp",
      scope: "ip",
      value: this.normalizeIp(clientIp),
      limit: 20,
      windowSeconds: 60 * 60,
      blockSeconds: 60 * 60
    });
    await this.consume({
      action: "otp",
      scope: "phone",
      value: phoneNumber,
      limit: 5,
      windowSeconds: 60 * 60,
      blockSeconds: 60 * 60
    });
  }

  private async consumeSensitiveMutation(
    action:
      | "order"
      | "shipping"
      | "shipping_configuration"
      | "payout"
      | "media"
      | "payment"
      | "payment_refund"
      | "payment_configuration"
      | "sms_configuration"
      | "bridge"
      | "signed_ticket"
      | "ai_profile"
      | "ai_profile_test"
      | "ai_run"
      | "product_bulk_undo",
    userId: string,
    clientIp: string,
    accountLimit: number,
    ipLimit: number
  ) {
    await this.consume({
      action,
      scope: "ip",
      value: this.normalizeIp(clientIp),
      limit: ipLimit,
      windowSeconds: 15 * 60,
      blockSeconds: 15 * 60
    });
    await this.consume({
      action,
      scope: "account",
      value: userId,
      limit: accountLimit,
      windowSeconds: 15 * 60,
      blockSeconds: 15 * 60
    });
    await this.pruneStaleBuckets();
  }

  private async consumePublicOperation(
    action: "payment_callback" | "staff_setup" | "checkout_quote",
    subjectScope: string,
    subjectValue: string,
    clientIp: string,
    subjectLimit: number,
    ipLimit: number,
    windowSeconds: number
  ) {
    await this.consume({
      action,
      scope: "ip",
      value: this.normalizeIp(clientIp),
      limit: ipLimit,
      windowSeconds,
      blockSeconds: windowSeconds
    });
    await this.consume({
      action,
      scope: subjectScope,
      value: subjectValue,
      limit: subjectLimit,
      windowSeconds,
      blockSeconds: windowSeconds
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
