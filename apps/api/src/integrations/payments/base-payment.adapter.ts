import {
  PaymentAdapter,
  PaymentIntentInput,
  PaymentIntentResult
} from "./payment.interface";

export abstract class BasePaymentAdapter implements PaymentAdapter {
  abstract readonly providerCode: "zarinpal" | "local-country-gateway" | "manual";

  abstract initiate(input: PaymentIntentInput): Promise<PaymentIntentResult>;
  abstract verify(
    providerReferenceId: string,
    amount: string
  ): Promise<{ verified: boolean; referenceId?: string }>;
  abstract refund(providerReferenceId: string, amount: string, reason: string): Promise<boolean>;
}

