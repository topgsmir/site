import { BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AdminShippingSettings } from "@topgsm/shared-types";
import { CredentialCryptoService } from "../../../common/security/credential-crypto.service";
import { PrismaService } from "../../../prisma/prisma.service";
import type { UpdateShippingSettingsDto } from "../dto/shipping-settings.dto";
import type { AmadastConfig } from "./amadast.types";

const SETTINGS_ID = 1;
const SETTINGS_SELECT = {
  amadast_enabled: true,
  encrypted_client_code: true,
  encryption_key_id: true,
  client_code_hint: true,
  user_id: true,
  store_id: true,
  product_type: true,
  package_type: true,
  updated_at: true
} as const;

type SettingsRecord = {
  amadast_enabled: boolean;
  encrypted_client_code: string | null;
  encryption_key_id: string | null;
  client_code_hint: string | null;
  user_id: number | null;
  store_id: number | null;
  product_type: number;
  package_type: number;
  updated_at: Date;
};

export type EffectiveAmadastSettings = AmadastConfig;

@Injectable()
export class AmadastSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CredentialCryptoService,
    private readonly config: ConfigService
  ) {}

  async get(): Promise<AdminShippingSettings> { return this.map(await this.read()); }

  async isEnabled() {
    const settings = await this.prisma.shipping_settings.findUnique({ where: { id: SETTINGS_ID }, select: { amadast_enabled: true } });
    return settings?.amadast_enabled ?? this.config.get<string>("AMADAST_SHIPPING_ENABLED") === "true";
  }

  async effective(): Promise<EffectiveAmadastSettings> {
    const settings = await this.read();
    const enabled = settings?.amadast_enabled ?? this.config.get<string>("AMADAST_SHIPPING_ENABLED") === "true";
    if (!enabled) throw new ServiceUnavailableException("Amadast shipping is not enabled");
    const clientCode = this.databaseClientCode(settings) ?? this.environmentString("AMADAST_CLIENT_CODE");
    const userId = settings?.user_id ?? this.environmentInteger("AMADAST_USER_ID");
    const storeId = settings?.store_id ?? this.environmentInteger("AMADAST_STORE_ID");
    const productType = settings?.product_type ?? this.environmentInteger("AMADAST_PRODUCT_TYPE") ?? 1;
    const packageType = settings?.package_type ?? this.environmentInteger("AMADAST_PACKAGE_TYPE") ?? 1;
    if (!clientCode || !userId || !storeId) throw new ServiceUnavailableException("Amadast shipping is not configured");
    return { clientCode, userId, storeId, productType, packageType };
  }

  async update(input: UpdateShippingSettingsDto, actorUserId: string): Promise<AdminShippingSettings> {
    const current = await this.read();
    const clientCode = input.clientCode?.trim();
    if (input.clientCode !== undefined && !clientCode) throw new BadRequestException("Amadast client code cannot be blank");
    const encrypted = clientCode ? this.crypto.encrypt(clientCode, this.clientCodePurpose(), "SHIPPING") : null;
    const nextUserId = Object.hasOwn(input, "userId") ? input.userId ?? null : current?.user_id ?? null;
    const nextStoreId = Object.hasOwn(input, "storeId") ? input.storeId ?? null : current?.store_id ?? null;
    const effectiveClientCode = clientCode ?? this.databaseClientCode(current) ?? this.environmentString("AMADAST_CLIENT_CODE");
    const effectiveUserId = nextUserId ?? this.environmentInteger("AMADAST_USER_ID");
    const effectiveStoreId = nextStoreId ?? this.environmentInteger("AMADAST_STORE_ID");
    if (input.enabled && (!effectiveClientCode || !effectiveUserId || !effectiveStoreId)) {
      throw new BadRequestException("Configure the Amadast client code, user ID, and store ID before enabling shipping");
    }
    const data = {
      amadast_enabled: input.enabled,
      user_id: nextUserId,
      store_id: nextStoreId,
      product_type: input.productType,
      package_type: input.packageType,
      ...(encrypted ? { encrypted_client_code: encrypted.ciphertext, encryption_key_id: encrypted.keyId, client_code_hint: clientCode!.slice(-4) } : {})
    };
    const updated = await this.prisma.$transaction(async (tx) => {
      const settings = await tx.shipping_settings.upsert({ where: { id: SETTINGS_ID }, create: { id: SETTINGS_ID, ...data }, update: data, select: SETTINGS_SELECT });
      await tx.shipping_setting_events.create({ data: {
        settings_id: SETTINGS_ID,
        actor_user_id: actorUserId,
        amadast_enabled: settings.amadast_enabled,
        credentials_changed: Boolean(encrypted),
        client_code_hint: settings.client_code_hint,
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
    const environmentClientCode = this.environmentString("AMADAST_CLIENT_CODE");
    const databaseConfigured = Boolean(settings?.encrypted_client_code && settings.encryption_key_id);
    return {
      enabled: settings?.amadast_enabled ?? this.config.get<string>("AMADAST_SHIPPING_ENABLED") === "true",
      provider: "amadast",
      clientCodeConfigured: databaseConfigured || Boolean(environmentClientCode),
      clientCodeHint: databaseConfigured ? settings?.client_code_hint ?? null : environmentClientCode?.slice(-4) ?? null,
      credentialSource: databaseConfigured ? "database" : environmentClientCode ? "environment" : "none",
      userId: settings?.user_id ?? this.environmentInteger("AMADAST_USER_ID"),
      storeId: settings?.store_id ?? this.environmentInteger("AMADAST_STORE_ID"),
      productType: settings?.product_type ?? this.environmentInteger("AMADAST_PRODUCT_TYPE") ?? 1,
      packageType: settings?.package_type ?? this.environmentInteger("AMADAST_PACKAGE_TYPE") ?? 1,
      updatedAt: settings?.updated_at.toISOString() ?? null
    };
  }

  private databaseClientCode(settings: SettingsRecord | null) {
    if (!settings?.encrypted_client_code || !settings.encryption_key_id) return null;
    return this.crypto.decrypt(settings.encrypted_client_code, settings.encryption_key_id, this.clientCodePurpose(), "SHIPPING");
  }
  private environmentString(key: string) { return this.config.get<string>(key)?.trim() || null; }
  private environmentInteger(key: string) {
    const value = Number(this.environmentString(key));
    return Number.isSafeInteger(value) && value > 0 && value <= 2_147_483_647 ? value : null;
  }
  private clientCodePurpose() { return "shipping:amadast:client-code"; }
}
