import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { ConfigService } from "@nestjs/config";
import { CredentialCryptoService } from "../../common/security/credential-crypto.service";
import type { PrismaService } from "../../prisma/prisma.service";
import { SmsSettingsService } from "./sms-settings.service";

const key = Buffer.alloc(32, 11).toString("base64");
const config = new ConfigService({
  SMS_CURRENT_KEY_ID: "sms1",
  SMS_CREDENTIAL_KEYS: `sms1:${key}`
});
const crypto = new CredentialCryptoService(config);

describe("SmsSettingsService", () => {
  it("returns a secret-safe default when the singleton row is not present", async () => {
    const prisma = {
      sms_settings: { findUnique: async () => null }
    } as unknown as PrismaService;

    const settings = await new SmsSettingsService(prisma, crypto, config).get();

    assert.deepEqual(settings, {
      otpEnabled: true,
      provider: "sms_ir",
      apiKeyConfigured: false,
      apiKeyHint: null,
      credentialSource: "none",
      templateIds: {
        otp: null,
        sellerNewOrder: null,
        buyerSuccess: null,
        buyerFailure: null
      },
      updatedAt: null
    });
  });

  it("encrypts a replacement API key and records only safe audit metadata", async () => {
    let persistedData: Record<string, unknown> | undefined;
    let auditData: Record<string, unknown> | undefined;
    const updatedAt = new Date("2026-09-15T09:00:00.000Z");
    const prisma = {
      sms_settings: { findUnique: async () => null },
      $transaction: async (callback: (client: {
        sms_settings: { upsert(args: { create: Record<string, unknown> }): Promise<Record<string, unknown>> };
        sms_setting_events: { create(args: { data: Record<string, unknown> }): Promise<{ id: string }> };
      }) => unknown) => callback({
        sms_settings: {
          upsert: async ({ create }) => {
            persistedData = create;
            return {
              otp_enabled: true,
              encrypted_api_key: create.encrypted_api_key,
              encryption_key_id: create.encryption_key_id,
              api_key_hint: create.api_key_hint,
              otp_template_id: 123,
              seller_new_order_template_id: 234,
              buyer_success_template_id: 345,
              buyer_failure_template_id: 456,
              updated_at: updatedAt
            };
          }
        },
        sms_setting_events: {
          create: async ({ data }) => {
            auditData = data;
            return { id: "event-id" };
          }
        }
      })
    } as unknown as PrismaService;

    const service = new SmsSettingsService(prisma, crypto, config);
    const settings = await service.update({
      otpEnabled: true,
      apiKey: "secret-sms-api-key",
      otpTemplateId: 123,
      sellerNewOrderTemplateId: 234,
      buyerSuccessTemplateId: 345,
      buyerFailureTemplateId: 456
    }, "admin-id");

    assert.equal(typeof persistedData?.encrypted_api_key, "string");
    assert.equal(String(persistedData?.encrypted_api_key).includes("secret-sms-api-key"), false);
    assert.equal(persistedData?.encryption_key_id, "sms1");
    assert.equal(persistedData?.api_key_hint, "-key");
    assert.equal(JSON.stringify(auditData).includes("secret-sms-api-key"), false);
    assert.deepEqual(auditData, {
      settings_id: 1,
      actor_user_id: "admin-id",
      otp_enabled: true,
      credentials_changed: true,
      api_key_hint: "-key",
      otp_template_id: 123,
      seller_new_order_template_id: 234,
      buyer_success_template_id: 345,
      buyer_failure_template_id: 456
    });
    assert.equal(settings.apiKeyConfigured, true);
    assert.equal(settings.apiKeyHint, "-key");
    assert.equal(settings.credentialSource, "database");
  });

  it("does not enable OTP until the API key and OTP template are usable", async () => {
    const prisma = {
      sms_settings: { findUnique: async () => null }
    } as unknown as PrismaService;

    await assert.rejects(
      () => new SmsSettingsService(prisma, crypto, config).update(
        { otpEnabled: true },
        "admin-id"
      ),
      /API key and OTP template/
    );
  });

  it("uses encrypted database credentials for delivery without exposing them", async () => {
    const encrypted = crypto.encrypt("database-sms-key", "sms:sms_ir:api-key", "SMS");
    const prisma = {
      sms_settings: {
        findUnique: async () => ({
          otp_enabled: true,
          encrypted_api_key: encrypted.ciphertext,
          encryption_key_id: encrypted.keyId,
          api_key_hint: "-key",
          otp_template_id: 987,
          seller_new_order_template_id: null,
          buyer_success_template_id: null,
          buyer_failure_template_id: null,
          updated_at: new Date()
        })
      }
    } as unknown as PrismaService;

    const credentials = await new SmsSettingsService(prisma, crypto, config).credentialsFor("otp");

    assert.deepEqual(credentials, { apiKey: "database-sms-key", templateId: 987 });
  });
});
