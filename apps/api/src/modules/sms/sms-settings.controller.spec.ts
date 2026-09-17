import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import type { AuthRateLimitService } from "../auth/auth-rate-limit.service";
import type { AuthenticatedRequest } from "../auth/platform-admin.guard";
import { SmsSettingsController } from "./sms-settings.controller";
import type { SmsSettingsService } from "./sms-settings.service";

describe("SmsSettingsController", () => {
  it("rate-limits a credential update before persisting it", async () => {
    const calls: string[] = [];
    const settings = {
      update: async () => {
        calls.push("update");
        return {
          otpEnabled: false,
          provider: "sms_ir" as const,
          apiKeyConfigured: true,
          apiKeyHint: "-key",
          credentialSource: "database" as const,
          templateIds: { otp: 123, sellerNewOrder: null, buyerSuccess: null, buyerFailure: null },
          updatedAt: new Date().toISOString()
        };
      }
    } as unknown as SmsSettingsService;
    const rateLimits = {
      consumeSmsConfiguration: async (userId: string, ip: string) => {
        calls.push(`limit:${userId}:${ip}`);
      }
    } as AuthRateLimitService;
    const controller = new SmsSettingsController(settings, rateLimits);

    await controller.update(
      { authenticatedUser: { id: "admin-id" } } as AuthenticatedRequest,
      "203.0.113.10",
      { otpEnabled: false, apiKey: "secret-sms-api-key", otpTemplateId: 123 }
    );

    assert.deepEqual(calls, ["limit:admin-id:203.0.113.10", "update"]);
  });
});
