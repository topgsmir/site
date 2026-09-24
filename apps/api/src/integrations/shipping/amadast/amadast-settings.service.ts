import { BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AdminShippingSettings } from "@topgsm/shared-types";
import { CredentialCryptoService } from "../../../common/security/credential-crypto.service";
import { PrismaService } from "../../../prisma/prisma.service";
import type { AmadastConfig } from "./amadast.types";

const SETTINGS_ID = 1;
const SETTINGS_SELECT = {
  provider: true,
  enabled: true,
  encrypted_api_key: true,
  encryption_key_id: true,
  api_key_hint: true,
  user_id: true,
  store_id: true,
  product_type: true,
  package_type: true,
  updated_at: true
} as const;

type SettingsRecord = {
  provider: string;
  enabled: boolean;
  encrypted_api_key: string | null;
  encryption_key_id: string | null;
  api_key_hint: string | null;
  user_id: number | null;
  store_id: number | null;
  product_type: number;
  package_type: number;
  updated_at: Date;
};

export type EffectiveAmadastSettings = Pick<AmadastConfig, "clientCode">;

@Injectable()
export class AmadastSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CredentialCryptoService,
    private readonly config: ConfigService
  ) {}

  async get(): Promise<AdminShippingSettings> { return this.map(await this.read()); }

  async isEnabled() {
    const settings = await this.read();
    return Boolean((settings?.provider === "amadast" && settings.encrypted_api_key && settings.encryption_key_id) || this.environmentClientCode());
  }

  async effective(): Promise<EffectiveAmadastSettings> {
    const settings = await this.read();
    const clientCode = this.databaseClientCode(settings) ?? this.environmentClientCode();
    if (!clientCode) throw new ServiceUnavailableException("Amadast API key is not configured");
    return { clientCode };
  }

  async updateApiKey(apiKey: string, actorUserId: string): Promise<AdminShippingSettings> {
    const clientCode = apiKey.trim();
    if (!clientCode) throw new BadRequestException("Amadast API key cannot be blank");
    const encrypted = this.crypto.encrypt(clientCode, this.clientCodePurpose(), "SHIPPING");
    const data = {
      provider: "amadast",
      enabled: true,
      encrypted_api_key: encrypted.ciphertext,
      encryption_key_id: encrypted.keyId,
      api_key_hint: clientCode.slice(-4)
    };
    const updated = await this.prisma.$transaction(async (tx) => {
      const settings = await tx.shipping_settings.upsert({ where: { id: SETTINGS_ID }, create: { id: SETTINGS_ID, ...data }, update: data, select: SETTINGS_SELECT });
      await tx.shipping_setting_events.create({ data: {
        settings_id: SETTINGS_ID,
        actor_user_id: actorUserId,
        provider: "amadast",
        enabled: settings.enabled,
        credentials_changed: true,
        api_key_hint: settings.api_key_hint,
        user_id: settings.user_id,
        store_id: settings.store_id,
        sender_name: null,
        sender_mobile: null,
        product_type: settings.product_type,
        package_type: settings.package_type
      } });
      return settings;
    });
    return this.map(updated);
  }

  private read(): Promise<SettingsRecord | null> { return this.prisma.shipping_settings.findUnique({ where: { id: SETTINGS_ID }, select: SETTINGS_SELECT }); }

  private map(settings: SettingsRecord | null): AdminShippingSettings {
    const environmentClientCode = this.environmentClientCode();
    const databaseConfigured = Boolean(settings?.provider === "amadast" && settings.encrypted_api_key && settings.encryption_key_id);
    return {
      enabled: databaseConfigured || Boolean(environmentClientCode),
      provider: "amadast",
      providerName: "Amadast",
      apiKeyConfigured: databaseConfigured || Boolean(environmentClientCode),
      apiKeyHint: databaseConfigured ? settings?.api_key_hint ?? null : environmentClientCode?.slice(-4) ?? null,
      credentialSource: databaseConfigured ? "database" : environmentClientCode ? "environment" : "none",
      updatedAt: settings?.updated_at.toISOString() ?? null
    };
  }

  private databaseClientCode(settings: SettingsRecord | null) {
    if (settings?.provider !== "amadast" || !settings.encrypted_api_key || !settings.encryption_key_id) return null;
    try {
      return this.crypto.decrypt(settings.encrypted_api_key, settings.encryption_key_id, this.clientCodePurpose(), "SHIPPING");
    } catch {
      return this.crypto.decrypt(settings.encrypted_api_key, settings.encryption_key_id, "shipping:amadast:client-code", "SHIPPING");
    }
  }
  private environmentString(key: string) { return this.config.get<string>(key)?.trim() || null; }
  private environmentClientCode() { return this.environmentString("AMADAST_API_KEY") ?? this.environmentString("AMADAST_CLIENT_CODE"); }
  private clientCodePurpose() { return "shipping:amadast:api-key"; }
}
