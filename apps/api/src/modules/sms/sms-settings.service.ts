import { BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import type { AdminSmsSettings } from "@topgsm/shared-types";
import { CredentialCryptoService } from "../../common/security/credential-crypto.service";
import { PrismaService } from "../../prisma/prisma.service";
import type { UpdateSmsSettingsDto } from "./dto/sms-settings.dto";
import type { SmsTemplate } from "./sms.service";

const SETTINGS_ID = 1;

const SETTINGS_SELECT = {
  otp_enabled: true,
  encrypted_api_key: true,
  encryption_key_id: true,
  api_key_hint: true,
  otp_template_id: true,
  seller_new_order_template_id: true,
  buyer_success_template_id: true,
  buyer_failure_template_id: true,
  updated_at: true
} as const;

type SettingsRecord = {
  otp_enabled: boolean;
  encrypted_api_key: string | null;
  encryption_key_id: string | null;
  api_key_hint: string | null;
  otp_template_id: number | null;
  seller_new_order_template_id: number | null;
  buyer_success_template_id: number | null;
  buyer_failure_template_id: number | null;
  updated_at: Date;
};

const templateColumns = {
  otp: "otp_template_id",
  seller_new_order: "seller_new_order_template_id",
  buyer_success: "buyer_success_template_id",
  buyer_failure: "buyer_failure_template_id"
} as const satisfies Record<SmsTemplate, keyof SettingsRecord>;

const templateEnvironment = {
  otp: "SMS_IR_TEMPLATE_OTP",
  seller_new_order: "SMS_IR_TEMPLATE_SELLER_NEW_ORDER",
  buyer_success: "SMS_IR_TEMPLATE_BUYER_SUCCESS",
  buyer_failure: "SMS_IR_TEMPLATE_BUYER_FAILURE"
} as const satisfies Record<SmsTemplate, string>;

@Injectable()
export class SmsSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CredentialCryptoService,
    private readonly config: ConfigService
  ) {}

  async get(): Promise<AdminSmsSettings> {
    const settings = await this.read();
    return this.map(settings);
  }

  async isOtpEnabled() {
    const settings = await this.prisma.sms_settings.findUnique({
      where: { id: SETTINGS_ID },
      select: { otp_enabled: true }
    });
    return settings?.otp_enabled ?? true;
  }

  async credentialsFor(template: SmsTemplate) {
    const settings = await this.read();
    const apiKey = this.databaseApiKey(settings) ?? this.environmentApiKey();
    const templateId = settings?.[templateColumns[template]] ?? this.environmentTemplateId(template);
    if (!apiKey || !templateId) {
      throw new ServiceUnavailableException(`SMS.ir template ${template} is not configured`);
    }
    return { apiKey, templateId };
  }

  async update(input: UpdateSmsSettingsDto, actorUserId: string): Promise<AdminSmsSettings> {
    const current = await this.read();
    const apiKey = input.apiKey?.trim();
    if (input.apiKey !== undefined && !apiKey) {
      throw new BadRequestException("SMS.ir API key cannot be blank");
    }

    const encrypted = apiKey
      ? this.crypto.encrypt(apiKey, this.apiKeyPurpose(), "SMS")
      : null;
    const data = {
      otp_enabled: input.otpEnabled,
      ...(encrypted ? {
        encrypted_api_key: encrypted.ciphertext,
        encryption_key_id: encrypted.keyId,
        api_key_hint: apiKey!.slice(-4)
      } : {}),
      ...(Object.hasOwn(input, "otpTemplateId") ? { otp_template_id: input.otpTemplateId ?? null } : {}),
      ...(Object.hasOwn(input, "sellerNewOrderTemplateId") ? { seller_new_order_template_id: input.sellerNewOrderTemplateId ?? null } : {}),
      ...(Object.hasOwn(input, "buyerSuccessTemplateId") ? { buyer_success_template_id: input.buyerSuccessTemplateId ?? null } : {}),
      ...(Object.hasOwn(input, "buyerFailureTemplateId") ? { buyer_failure_template_id: input.buyerFailureTemplateId ?? null } : {})
    };

    const effectiveApiKey = apiKey ?? this.databaseApiKey(current) ?? this.environmentApiKey();
    const effectiveOtpTemplateId = Object.hasOwn(input, "otpTemplateId")
      ? input.otpTemplateId ?? this.environmentTemplateId("otp")
      : current?.otp_template_id ?? this.environmentTemplateId("otp");
    if (input.otpEnabled && (!effectiveApiKey || !effectiveOtpTemplateId)) {
      throw new BadRequestException("Configure the SMS.ir API key and OTP template before enabling OTP");
    }

    const settings = await this.prisma.$transaction(async (transaction) => {
      const updated = await transaction.sms_settings.upsert({
        where: { id: SETTINGS_ID },
        create: { id: SETTINGS_ID, ...data },
        update: data,
        select: SETTINGS_SELECT
      });

      await transaction.sms_setting_events.create({
        data: {
          settings_id: SETTINGS_ID,
          actor_user_id: actorUserId,
          otp_enabled: updated.otp_enabled,
          credentials_changed: Boolean(encrypted),
          api_key_hint: updated.api_key_hint,
          otp_template_id: updated.otp_template_id,
          seller_new_order_template_id: updated.seller_new_order_template_id,
          buyer_success_template_id: updated.buyer_success_template_id,
          buyer_failure_template_id: updated.buyer_failure_template_id
        }
      });
      return updated;
    });

    return this.map(settings);
  }

  private read(): Promise<SettingsRecord | null> {
    return this.prisma.sms_settings.findUnique({
      where: { id: SETTINGS_ID },
      select: SETTINGS_SELECT
    });
  }

  private map(settings: SettingsRecord | null): AdminSmsSettings {
    const environmentApiKey = this.environmentApiKey();
    const databaseConfigured = Boolean(settings?.encrypted_api_key && settings.encryption_key_id);
    return {
      otpEnabled: settings?.otp_enabled ?? true,
      provider: "sms_ir",
      apiKeyConfigured: databaseConfigured || Boolean(environmentApiKey),
      apiKeyHint: databaseConfigured ? settings?.api_key_hint ?? null : environmentApiKey?.slice(-4) ?? null,
      credentialSource: databaseConfigured ? "database" : environmentApiKey ? "environment" : "none",
      templateIds: {
        otp: settings?.otp_template_id ?? this.environmentTemplateId("otp"),
        sellerNewOrder: settings?.seller_new_order_template_id ?? this.environmentTemplateId("seller_new_order"),
        buyerSuccess: settings?.buyer_success_template_id ?? this.environmentTemplateId("buyer_success"),
        buyerFailure: settings?.buyer_failure_template_id ?? this.environmentTemplateId("buyer_failure")
      },
      updatedAt: settings?.updated_at.toISOString() ?? null
    };
  }

  private databaseApiKey(settings: SettingsRecord | null) {
    if (!settings?.encrypted_api_key || !settings.encryption_key_id) return null;
    return this.crypto.decrypt(
      settings.encrypted_api_key,
      settings.encryption_key_id,
      this.apiKeyPurpose(),
      "SMS"
    );
  }

  private environmentApiKey() {
    return this.config.get<string>("SMS_IR_API_KEY")?.trim() || null;
  }

  private environmentTemplateId(template: SmsTemplate) {
    const value = Number(this.config.get<string>(templateEnvironment[template]));
    return Number.isSafeInteger(value) && value > 0 ? value : null;
  }

  private apiKeyPurpose() {
    return "sms:sms_ir:api-key";
  }
}
