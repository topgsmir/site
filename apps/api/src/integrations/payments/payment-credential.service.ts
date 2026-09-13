import { BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { CredentialCryptoService } from "../../common/security/credential-crypto.service";
import { PrismaService } from "../../prisma/prisma.service";
import type { PaymentProviderUnavailabilityReason } from "./payment.interface";

export type ZarinpalCredentials = {
  merchantId?: string;
  callbackUrl?: string;
  refundAccessToken?: string;
};

export type PaymentCredentialInput = {
  merchantId?: string;
  callbackUrl?: string;
  refundAccessToken?: string;
  clearRefundAccessToken?: boolean;
};

type CredentialEnvelope = {
  encrypted_credentials: string | null;
  encryption_key_id: string | null;
  merchant_id_hint: string | null;
  refund_token_hint: string | null;
};

@Injectable()
export class PaymentCredentialService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CredentialCryptoService
  ) {}

  async zarinpal(): Promise<Required<Pick<ZarinpalCredentials, "merchantId" | "callbackUrl">> & ZarinpalCredentials> {
    const row = await this.prisma.payment_method_configs.findUnique({
      where: { provider_code: "zarinpal" },
      select: {
        encrypted_credentials: true,
        encryption_key_id: true,
        merchant_id_hint: true,
        refund_token_hint: true
      }
    });
    const credentials = this.decrypt("zarinpal", row);
    const reason = this.unavailabilityReason(credentials);
    if (reason) throw new ServiceUnavailableException("Zarinpal credentials are not configured");
    return credentials as Required<Pick<ZarinpalCredentials, "merchantId" | "callbackUrl">> & ZarinpalCredentials;
  }

  async availability(providerCode: string) {
    if (providerCode !== "zarinpal") return null;
    const row = await this.prisma.payment_method_configs.findUnique({
      where: { provider_code: providerCode },
      select: {
        encrypted_credentials: true,
        encryption_key_id: true,
        merchant_id_hint: true,
        refund_token_hint: true
      }
    });
    const credentials = this.decrypt(providerCode, row);
    return {
      reason: this.unavailabilityReason(credentials),
      configuration: this.summary(credentials, row)
    };
  }

  async prepareUpdate(providerCode: string, input?: PaymentCredentialInput) {
    if (providerCode !== "zarinpal") {
      if (input && Object.values(input).some(Boolean)) {
        throw new BadRequestException("This payment provider has no configurable credentials");
      }
      return { data: {}, reason: null, configuration: null };
    }

    const row = await this.prisma.payment_method_configs.findUnique({
      where: { provider_code: providerCode },
      select: {
        encrypted_credentials: true,
        encryption_key_id: true,
        merchant_id_hint: true,
        refund_token_hint: true
      }
    });
    const current = this.decrypt(providerCode, row);
    const merchantId = input?.merchantId?.trim();
    const callbackUrl = input?.callbackUrl?.trim();
    const refundAccessToken = input?.refundAccessToken?.trim();
    const next: ZarinpalCredentials = {
      ...current,
      ...(merchantId ? { merchantId } : {}),
      ...(callbackUrl ? { callbackUrl } : {}),
      ...(refundAccessToken ? { refundAccessToken } : {})
    };
    if (input?.clearRefundAccessToken) delete next.refundAccessToken;

    const changed = Boolean(merchantId || callbackUrl || refundAccessToken || input?.clearRefundAccessToken);
    const encrypted = changed
      ? this.crypto.encrypt(JSON.stringify(next), this.purpose(providerCode), "PAYMENT")
      : null;
    const data = encrypted ? {
      encrypted_credentials: encrypted.ciphertext,
      encryption_key_id: encrypted.keyId,
      merchant_id_hint: next.merchantId?.slice(-4) ?? null,
      refund_token_hint: next.refundAccessToken?.slice(-4) ?? null
    } : {};

    return {
      data,
      reason: this.unavailabilityReason(next),
      configuration: this.summary(next, encrypted ? {
        encrypted_credentials: encrypted.ciphertext,
        encryption_key_id: encrypted.keyId,
        merchant_id_hint: next.merchantId?.slice(-4) ?? null,
        refund_token_hint: next.refundAccessToken?.slice(-4) ?? null
      } : row)
    };
  }

  private decrypt(providerCode: string, row: CredentialEnvelope | null): ZarinpalCredentials {
    if (!row?.encrypted_credentials || !row.encryption_key_id) return {};
    const plaintext = this.crypto.decrypt(
      row.encrypted_credentials,
      row.encryption_key_id,
      this.purpose(providerCode),
      "PAYMENT"
    );
    try {
      const value = JSON.parse(plaintext) as Record<string, unknown>;
      if (!value || typeof value !== "object") throw new Error("invalid");
      for (const key of ["merchantId", "callbackUrl", "refundAccessToken"] as const) {
        if (value[key] !== undefined && typeof value[key] !== "string") throw new Error("invalid");
      }
      return {
        ...(typeof value.merchantId === "string" ? { merchantId: value.merchantId } : {}),
        ...(typeof value.callbackUrl === "string" ? { callbackUrl: value.callbackUrl } : {}),
        ...(typeof value.refundAccessToken === "string" ? { refundAccessToken: value.refundAccessToken } : {})
      };
    } catch {
      throw new ServiceUnavailableException("Encrypted payment credentials are invalid");
    }
  }

  private unavailabilityReason(credentials: ZarinpalCredentials): PaymentProviderUnavailabilityReason | null {
    if (!credentials.merchantId?.trim()) return "missing_merchant_id";
    if (!credentials.callbackUrl?.trim().startsWith("https://")) return "missing_callback_url";
    return null;
  }

  private summary(credentials: ZarinpalCredentials, row: CredentialEnvelope | null) {
    return {
      merchantIdConfigured: Boolean(credentials.merchantId),
      merchantIdHint: row?.merchant_id_hint ?? null,
      callbackUrlConfigured: Boolean(credentials.callbackUrl),
      refundAccessTokenConfigured: Boolean(credentials.refundAccessToken),
      refundAccessTokenHint: row?.refund_token_hint ?? null
    };
  }

  private purpose(providerCode: string) {
    return `payment:${providerCode}:credentials`;
  }
}
