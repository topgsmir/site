export type PaymentStatus = "pending" | "succeeded" | "failed" | "refunded";

export type PaymentProviderCode = "local-country-gateway" | "manual";

export interface PaymentIntentInput {
  orderId: string;
  sellerId: string;
  buyerId: string;
  amount: number;
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
  verify(providerReferenceId: string): Promise<boolean>;
  refund(providerReferenceId: string, reason: string): Promise<boolean>;
}

