export type PaymentStatus = "pending" | "succeeded" | "failed" | "refunded";

export type PaymentProviderCode = "zarinpal" | "local-country-gateway" | "manual";

export type PaymentProviderUnavailabilityReason =
  | "development_only"
  | "missing_merchant_id"
  | "missing_callback_url";

export interface PaymentProviderDescriptor {
  code: PaymentProviderCode;
  name: string;
  available: boolean;
  unavailabilityReason: PaymentProviderUnavailabilityReason | null;
  currencies: string[];
  supportsRefunds: boolean;
  configuration: {
    merchantIdConfigured: boolean;
    merchantIdHint: string | null;
    callbackUrlConfigured: boolean;
    refundAccessTokenConfigured: boolean;
    refundAccessTokenHint: string | null;
  } | null;
}

export interface PaymentIntentInput {
  operationId: string;
  orderId: string;
  sellerId: string;
  buyerId: string;
  amount: string;
  currency: string;
  metadata?: Record<string, string>;
}

export interface PaymentRefundInput {
  operationId: string;
  providerReferenceId: string;
  amount: string;
  reason: string;
}

export interface PaymentRefundResult {
  providerRefundId: string;
}

export interface PaymentIntentResult {
  providerReferenceId: string;
  status: PaymentStatus;
  paymentUrl?: string;
  qrCode?: string;
}

export interface PaymentAdapter {
  readonly providerCode: PaymentProviderCode;
  readonly displayName: string;
  readonly supportedCurrencies: readonly string[];
  readonly supportsRefunds: boolean;
  availability(): Promise<{
    available: boolean;
    unavailabilityReason: PaymentProviderUnavailabilityReason | null;
    configuration: PaymentProviderDescriptor["configuration"];
  }>;
  paymentUrl(providerReferenceId: string): string | undefined;
  initiate(input: PaymentIntentInput): Promise<PaymentIntentResult>;
  verify(
    providerReferenceId: string,
    amount: string
  ): Promise<{ verified: boolean; referenceId?: string }>;
  inquiry?(providerReferenceId: string, amount: string): Promise<boolean>;
  refund(input: PaymentRefundInput): Promise<PaymentRefundResult | null>;
}

