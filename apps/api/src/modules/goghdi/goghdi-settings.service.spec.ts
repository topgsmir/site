import { strict as assert } from "node:assert";
import { describe, it } from "node:test";
import { ConfigService } from "@nestjs/config";
import { CredentialCryptoService } from "../../common/security/credential-crypto.service";
import type { PrismaService } from "../../prisma/prisma.service";
import { GoghdiSettingsService } from "./goghdi-settings.service";

const key = Buffer.alloc(32, 19).toString("base64");
const config = new ConfigService({
  NODE_ENV: "test",
  GOGHDI_CURRENT_KEY_ID: "goghdi1",
  GOGHDI_CREDENTIAL_KEYS: `goghdi1:${key}`
});
const crypto = new CredentialCryptoService(config);

describe("GoghdiSettingsService", () => {
  it("returns a disabled, secret-safe public configuration by default", async () => {
    const prisma = { goghdi_settings: { findUnique: async () => null } } as unknown as PrismaService;
    const service = new GoghdiSettingsService(prisma, crypto, config);

    assert.deepEqual(await service.getPublic(), {
      enabled: false,
      sdkUrl: null,
      tenantId: null,
      apiUrl: null,
      socketUrl: null,
      widgetUrl: null
    });
  });

  it("encrypts the tenant secret and keeps it out of audit data and responses", async () => {
    let stored: Record<string, unknown> | undefined;
    let audit: Record<string, unknown> | undefined;
    let record: Record<string, unknown> | null = null;
    const prisma = {
      goghdi_settings: { findUnique: async () => record },
      $transaction: async (callback: (client: unknown) => unknown) => callback({
        goghdi_settings: {
          upsert: async ({ create }: { create: Record<string, unknown> }) => {
            stored = create;
            record = {
              enabled: create.enabled,
              sdk_url: create.sdk_url,
              tenant_id: create.tenant_id,
              api_url: create.api_url,
              socket_url: create.socket_url,
              widget_url: create.widget_url,
              encrypted_tenant_secret: create.encrypted_tenant_secret,
              encryption_key_id: create.encryption_key_id,
              tenant_secret_hint: create.tenant_secret_hint,
              updated_at: new Date("2026-09-21T10:00:00.000Z")
            };
            return record;
          }
        },
        goghdi_setting_events: {
          create: async ({ data }: { data: Record<string, unknown> }) => { audit = data; return { id: "event-1" }; }
        }
      })
    } as unknown as PrismaService;
    const service = new GoghdiSettingsService(prisma, crypto, config);

    const result = await service.update({
      enabled: true,
      sdkUrl: "https://chat.example/sdk.js",
      tenantId: "tenant-1",
      apiUrl: "https://chat.example/api",
      socketUrl: null,
      widgetUrl: "https://chat.example/widget",
      tenantSecret: "a-private-tenant-secret"
    }, "admin-1");

    assert.equal(String(stored?.encrypted_tenant_secret).includes("a-private-tenant-secret"), false);
    assert.equal(stored?.encryption_key_id, "goghdi1");
    assert.equal(JSON.stringify(audit).includes("a-private-tenant-secret"), false);
    assert.equal(result.tenantSecretConfigured, true);
    assert.equal(result.tenantSecretHint, "cret");
    assert.equal("tenantSecret" in result, false);
    assert.deepEqual(audit, {
      settings_id: 1,
      actor_user_id: "admin-1",
      enabled: true,
      changed_fields: ["enabled", "sdkUrl", "tenantId", "apiUrl", "widgetUrl", "tenantSecret"],
      credentials_changed: true
    });
  });

  it("refuses to enable chat without a complete connection and secret", async () => {
    const prisma = { goghdi_settings: { findUnique: async () => null } } as unknown as PrismaService;
    const service = new GoghdiSettingsService(prisma, crypto, config);
    await assert.rejects(() => service.update({ enabled: true }, "admin-1"), /required Goghdi URLs/i);
  });
});
