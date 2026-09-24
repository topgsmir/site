import { strict as assert } from "node:assert";
import { ConfigService } from "@nestjs/config";
import { describe, it } from "node:test";
import { CredentialCryptoService } from "../../../common/security/credential-crypto.service";
import type { PrismaService } from "../../../prisma/prisma.service";
import { AmadastSettingsService } from "./amadast-settings.service";

const key = Buffer.alloc(32, 19).toString("base64");
const config = new ConfigService({ SHIPPING_CURRENT_KEY_ID: "ship1", SHIPPING_CREDENTIAL_KEYS: `ship1:${key}` });
const crypto = new CredentialCryptoService(config);

describe("AmadastSettingsService", () => {
  it("returns a secret-safe default", async () => {
    const prisma = { shipping_settings: { findUnique: async () => null } } as unknown as PrismaService;
    const settings = await new AmadastSettingsService(prisma, crypto, config).get();
    assert.equal(settings.enabled, false);
    assert.equal(settings.apiKeyConfigured, false);
    assert.equal("apiKey" in settings, false);
  });

  it("encrypts the client code and writes secret-free audit data", async () => {
    let stored: Record<string, unknown> | undefined;
    let audited: Record<string, unknown> | undefined;
    const prisma = {
      shipping_settings: { findUnique: async () => null },
      $transaction: async (callback: (tx: Record<string, unknown>) => unknown) => callback({
        shipping_settings: { upsert: async ({ create }: { create: Record<string, unknown> }) => {
          stored = create;
          return { provider: "amadast", enabled: true, encrypted_api_key: create.encrypted_api_key, encryption_key_id: create.encryption_key_id, api_key_hint: create.api_key_hint, user_id: 12, store_id: 34, sender_name: "TopGSM", sender_mobile: "09120000000", product_type: 1, package_type: 1, updated_at: new Date("2026-09-17T00:00:00Z") };
        } },
        shipping_setting_events: { create: async ({ data }: { data: Record<string, unknown> }) => { audited = data; return { id: "event" }; } }
      })
    } as unknown as PrismaService;
    const result = await new AmadastSettingsService(prisma, crypto, config).updateApiKey("secret-client-code", "admin-id");
    assert.equal(String(stored?.encrypted_api_key).includes("secret-client-code"), false);
    assert.equal(JSON.stringify(audited).includes("secret-client-code"), false);
    assert.equal(result.apiKeyHint, "code");
  });

  it("decrypts database credentials for shipping without returning them to admins", async () => {
    const encrypted = crypto.encrypt("database-client-code", "shipping:amadast:client-code", "SHIPPING");
    const prisma = { shipping_settings: { findUnique: async () => ({ provider: "amadast", enabled: true, encrypted_api_key: encrypted.ciphertext, encryption_key_id: encrypted.keyId, api_key_hint: "code", user_id: 12, store_id: 34, sender_name: null, sender_mobile: null, product_type: 1, package_type: 1, updated_at: new Date() }) } } as unknown as PrismaService;
    const effective = await new AmadastSettingsService(prisma, crypto, config).effective();
    assert.deepEqual(effective, { clientCode: "database-client-code" });
  });
});
