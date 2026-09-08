export type PaymentStatus = "pending" | "succeeded" | "failed" | "refunded";

export type PaymentProviderCode = "zarinpal" | "local-country-gateway" | "manual";

export interface PaymentIntentInput {
  orderId: string;
  sellerId: string;
  buyerId: string;
  amount: string;
  currency: string;
  metadata?: Record<string, string>;
}

export interface PaymentIntentResult {
  providerReferenceId: string;
  status: PaymentStatus;
  paymentUrl?: string;
  qrCode?: string;
}

export interface PaymentAdapter {
  readonly providerCode: PaymentProviderCode;
  initiate(input: PaymentIntentInput): Promise<PaymentIntentResult>;
  verify(
    providerReferenceId: string,
    amount: string
  ): Promise<{ verified: boolean; referenceId?: string }>;
  inquiry?(providerReferenceId: string, amount: string): Promise<boolean>;
  refund(providerReferenceId: string, amount: string, reason: string): Promise<boolean>;
}

