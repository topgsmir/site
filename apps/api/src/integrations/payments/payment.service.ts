import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { BasePaymentAdapter } from "./base-payment.adapter";
import { LocalGatewayAdapter } from "./providers/local-gateway/local-gateway.adapter";
import { ZarinpalAdapter } from "./providers/zarinpal/zarinpal.adapter";
import {
  PaymentIntentInput,
  PaymentIntentResult,
  PaymentProviderDescriptor
} from "./payment.interface";

type ProviderMap = Record<string, BasePaymentAdapter>;

@Injectable()
export class PaymentService {
  private readonly adapters: ProviderMap = {};

  constructor(
    @Inject(LocalGatewayAdapter) private readonly local: BasePaymentAdapter,
    @Inject(ZarinpalAdapter) private readonly zarinpal: BasePaymentAdapter
  ) {
    this.adapters[this.local.providerCode] = local;
    this.adapters[this.zarinpal.providerCode] = zarinpal;
  }

  get(providerCode: string): BasePaymentAdapter {
    const adapter = this.adapters[providerCode];
    if (!adapter) throw new BadRequestException("Unsupported payment provider");
    return adapter;
  }

  async listProviders(): Promise<PaymentProviderDescriptor[]> {
    return Promise.all(Object.values(this.adapters).map(async (adapter) => {
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

