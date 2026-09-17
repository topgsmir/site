import {
  PaymentAdapter,
  PaymentIntentInput,
  PaymentIntentResult,
  PaymentRefundInput,
  PaymentRefundResult
} from "./payment.interface";

export abstract class BasePaymentAdapter implements PaymentAdapter {
  abstract readonly providerCode: "zarinpal" | "local-country-gateway" | "manual";
  abstract readonly displayName: string;
  abstract readonly supportedCurrencies: readonly string[];
  readonly supportsRefunds: boolean = true;

  abstract availability(): Promise<{
    available: boolean;
    unavailabilityReason: "development_only" | "missing_merchant_id" | "missing_callback_url" | null;
    configuration: import("./payment.interface").PaymentProviderDescriptor["configuration"];
  }>;
  abstract paymentUrl(providerReferenceId: string): string | undefined;
  abstract initiate(input: PaymentIntentInput): Promise<PaymentIntentResult>;
  abstract verify(
    providerReferenceId: string,
    amount: string
  ): Promise<{ verified: boolean; referenceId?: string }>;
  inquiry?(providerReferenceId: string, amount: string): Promise<boolean>;
  abstract refund(input: PaymentRefundInput): Promise<PaymentRefundResult | null>;
}

