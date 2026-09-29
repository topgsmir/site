import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { BasePaymentAdapter } from "./base-payment.adapter";
import {
  PaymentIntentInput,
  PaymentIntentResult,
  PaymentProviderDescriptor
} from "./payment.interface";

export const PAYMENT_ADAPTERS = Symbol("PAYMENT_ADAPTERS");

@Injectable()
export class PaymentService {
  private readonly adapters: Map<string, BasePaymentAdapter>;

  constructor(@Inject(PAYMENT_ADAPTERS) adapters: BasePaymentAdapter[]) {
    this.adapters = new Map(adapters.map((adapter) => [adapter.providerCode, adapter]));
    if (this.adapters.size !== adapters.length) throw new Error("Duplicate payment provider code");
  }

  get(providerCode: string): BasePaymentAdapter {
    const adapter = this.adapters.get(providerCode);
    if (!adapter) throw new BadRequestException("Unsupported payment provider");
    return adapter;
  }

  async listProviders(): Promise<PaymentProviderDescriptor[]> {
    return Promise.all([...this.adapters.values()].map(async (adapter) => {
      const availability = await adapter.availability();
      return {
        code: adapter.providerCode,
        name: adapter.displayName,
        available: availability.available,
        unavailabilityReason: availability.unavailabilityReason,
        currencies: [...adapter.supportedCurrencies],
        supportsRefunds: adapter.supportsRefunds,
        configuration: availability.configuration
      };
    }));
  }

  initiateWithProvider(
    providerCode: string,
    input: PaymentIntentInput
  ): Promise<PaymentIntentResult> {
    return this.get(providerCode).initiate(input);
  }
}

