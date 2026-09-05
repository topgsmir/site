import { Inject, Injectable } from "@nestjs/common";
import { BasePaymentAdapter } from "./base-payment.adapter";
import { LocalGatewayAdapter } from "./providers/local-gateway/local-gateway.adapter";
import { PaymentAdapter, PaymentIntentInput, PaymentIntentResult } from "./payment.interface";

type ProviderMap = Record<string, PaymentAdapter>;

@Injectable()
export class PaymentService {
  private readonly adapters: ProviderMap = {};

  constructor(
    @Inject(LocalGatewayAdapter) private readonly local: BasePaymentAdapter
  ) {
    this.adapters[this.local.providerCode] = local;
  }

  get(providerCode: string): BasePaymentAdapter {
    return this.adapters[providerCode];
  }

  initiateWithProvider(
    providerCode: string,
    input: PaymentIntentInput
  ): Promise<PaymentIntentResult> {
    return this.get(providerCode).initiate(input);
  }
}

