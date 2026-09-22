import { BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AdminGoghdiSettings, GoghdiPublicConfig } from "@topgsm/shared-types";
import { CredentialCryptoService } from "../../common/security/credential-crypto.service";
import { PrismaService } from "../../prisma/prisma.service";
import type { UpdateGoghdiSettingsDto } from "./dto/goghdi-settings.dto";

const SETTINGS_ID = 1;
const SETTINGS_SELECT = {
  enabled: true,
  sdk_url: true,
  tenant_id: true,
  api_url: true,
  socket_url: true,
  widget_url: true,
  encrypted_tenant_secret: true,
  encryption_key_id: true,
  tenant_secret_hint: true,
  updated_at: true
} as const;

type SettingsRecord = {
  enabled: boolean;
  sdk_url: string | null;
  tenant_id: string | null;
  api_url: string | null;
  socket_url: string | null;
  widget_url: string | null;
  encrypted_tenant_secret: string | null;
  encryption_key_id: string | null;
  tenant_secret_hint: string | null;
  updated_at: Date;
};

@Injectable()
export class GoghdiSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CredentialCryptoService,
    private readonly config: ConfigService
  ) {}

  async getPublic(): Promise<GoghdiPublicConfig> {
    const settings = await this.read();
    const values = this.effectivePublicValues(settings);
    const environmentDefault = !settings && this.hasCompletePublicConfig(values);
    return {
      enabled: settings?.enabled ?? environmentDefault,
      ...values
    };
  }

  async getAdmin(): Promise<AdminGoghdiSettings> {
    const settings = await this.read();
    const publicConfig = await this.getPublic();
    const databaseConfigured = Boolean(settings?.encrypted_tenant_secret && settings.encryption_key_id);
    const environmentSecret = this.environmentSecret();
    return {
      ...publicConfig,
      tenantSecretConfigured: databaseConfigured || Boolean(environmentSecret),
      tenantSecretHint: databaseConfigured
        ? settings?.tenant_secret_hint ?? null
        : environmentSecret?.slice(-4) ?? null,
      credentialSource: databaseConfigured ? "database" : environmentSecret ? "environment" : "none",
      updatedAt: settings?.updated_at.toISOString() ?? null
    };
  }

  async update(input: UpdateGoghdiSettingsDto, actorUserId: string): Promise<AdminGoghdiSettings> {
    const current = await this.read();
    const tenantSecret = input.tenantSecret?.trim();
    if (input.tenantSecret !== undefined && !tenantSecret) {
      throw new BadRequestException("Goghdi tenant secret cannot be blank");
    }
    const encrypted = tenantSecret
      ? this.crypto.encrypt(tenantSecret, this.secretPurpose(), "GOGHDI")
      : null;

    const publicValues = {
      sdk_url: this.normalizeUrl(input.sdkUrl, "SDK URL"),
      tenant_id: this.normalizeText(input.tenantId),
      api_url: this.normalizeUrl(input.apiUrl, "API URL"),
      socket_url: this.normalizeUrl(input.socketUrl, "socket URL"),
      widget_url: this.normalizeUrl(input.widgetUrl, "widget URL")
    };
    const candidate: SettingsRecord = {
      enabled: input.enabled,
      ...publicValues,
      encrypted_tenant_secret: encrypted?.ciphertext ?? current?.encrypted_tenant_secret ?? null,
      encryption_key_id: encrypted?.keyId ?? current?.encryption_key_id ?? null,
      tenant_secret_hint: tenantSecret?.slice(-4) ?? current?.tenant_secret_hint ?? null,
      updated_at: current?.updated_at ?? new Date()
    };
    const effectivePublic = this.effectivePublicValues(candidate);
    const effectiveSecret = tenantSecret ?? this.databaseSecret(current) ?? this.environmentSecret();
    if (input.enabled && (!this.hasCompletePublicConfig(effectivePublic) || !effectiveSecret)) {
      throw new BadRequestException("Configure all required Goghdi URLs, tenant ID, and tenant secret before enabling chat");
    }

    const changedFields: string[] = ([
      ["enabled", current?.enabled ?? false, input.enabled],
      ["sdkUrl", current?.sdk_url ?? null, publicValues.sdk_url],
      ["tenantId", current?.tenant_id ?? null, publicValues.tenant_id],
      ["apiUrl", current?.api_url ?? null, publicValues.api_url],
      ["socketUrl", current?.socket_url ?? null, publicValues.socket_url],
      ["widgetUrl", current?.widget_url ?? null, publicValues.widget_url]
    ] as const).filter(([, before, after]) => before !== after).map(([name]) => name);
    if (encrypted) changedFields.push("tenantSecret");

    await this.prisma.$transaction(async (transaction) => {
      await transaction.goghdi_settings.upsert({
        where: { id: SETTINGS_ID },
        create: {
          id: SETTINGS_ID,
          enabled: input.enabled,
          ...publicValues,
          ...(encrypted ? {
            encrypted_tenant_secret: encrypted.ciphertext,
            encryption_key_id: encrypted.keyId,
            tenant_secret_hint: tenantSecret!.slice(-4)
          } : {})
        },
        update: {
          enabled: input.enabled,
          ...publicValues,
          ...(encrypted ? {
            encrypted_tenant_secret: encrypted.ciphertext,
            encryption_key_id: encrypted.keyId,
            tenant_secret_hint: tenantSecret!.slice(-4)
          } : {})
        }
      });
      await transaction.goghdi_setting_events.create({
        data: {
          settings_id: SETTINGS_ID,
          actor_user_id: actorUserId,
          enabled: input.enabled,
          changed_fields: changedFields,
          credentials_changed: Boolean(encrypted)
        }
      });
    });
    return this.getAdmin();
  }

  async ticketCredentials() {
    const settings = await this.read();
    const publicConfig = await this.getPublic();
    const secret = this.databaseSecret(settings) ?? this.environmentSecret();
    if (!publicConfig.enabled || !this.hasCompletePublicConfig(publicConfig) || !secret) {
      throw new ServiceUnavailableException("Chat support is not configured");
    }
    return { secret };
  }

  private read(): Promise<SettingsRecord | null> {
    return this.prisma.goghdi_settings.findUnique({ where: { id: SETTINGS_ID }, select: SETTINGS_SELECT });
  }

  private effectivePublicValues(settings: SettingsRecord | null) {
    return {
      sdkUrl: settings?.sdk_url ?? this.environment("NEXT_PUBLIC_GOGHDI_SDK_URL"),
      tenantId: settings?.tenant_id ?? this.environment("NEXT_PUBLIC_GOGHDI_TENANT_ID"),
      apiUrl: settings?.api_url ?? this.environment("NEXT_PUBLIC_GOGHDI_API_URL"),
      socketUrl: settings?.socket_url ?? this.environment("NEXT_PUBLIC_GOGHDI_SOCKET_URL"),
      widgetUrl: settings?.widget_url ?? this.environment("NEXT_PUBLIC_GOGHDI_WIDGET_URL")
    };
  }

  private hasCompletePublicConfig(value: Pick<GoghdiPublicConfig, "sdkUrl" | "tenantId" | "apiUrl" | "widgetUrl">) {
    return Boolean(value.sdkUrl && value.tenantId && value.apiUrl && value.widgetUrl);
  }

  private databaseSecret(settings: SettingsRecord | null) {
    if (!settings?.encrypted_tenant_secret || !settings.encryption_key_id) return null;
    return this.crypto.decrypt(
      settings.encrypted_tenant_secret,
      settings.encryption_key_id,
      this.secretPurpose(),
      "GOGHDI"
    );
  }

  private environmentSecret() {
    return this.environment("GOGHDI_TENANT_SECRET");
  }

  private environment(name: string) {
    return this.config.get<string>(name)?.trim() || null;
  }

  private normalizeText(value: string | null | undefined) {
    return value?.trim() || null;
  }

  private normalizeUrl(value: string | null | undefined, label: string) {
    const normalized = this.normalizeText(value);
    if (!normalized) return null;
    const parsed = new URL(normalized);
    if (this.config.get<string>("NODE_ENV") === "production" && parsed.protocol !== "https:") {
      throw new BadRequestException(`${label} must use HTTPS in production`);
    }
    return normalized.replace(/\/$/, "");
  }

  private secretPurpose() {
    return "goghdi:tenant-secret";
  }
}
