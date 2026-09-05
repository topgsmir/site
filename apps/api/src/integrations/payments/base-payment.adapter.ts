import {
  PaymentAdapter,
  PaymentIntentInput,
  PaymentIntentResult
} from "./payment.interface";

export abstract class BasePaymentAdapter implements PaymentAdapter {
  abstract readonly providerCode: "local-country-gateway" | "manual";

  abstract initiate(input: PaymentIntentInput): Promise<PaymentIntentResult>;
  abstract verify(providerReferenceId: string): Promise<boolean>;
  abstract refund(providerReferenceId: string, reason: string): Promise<boolean>;
}

