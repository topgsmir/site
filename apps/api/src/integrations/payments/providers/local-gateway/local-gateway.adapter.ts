import { Injectable } from "@nestjs/common";
import { BasePaymentAdapter } from "../../base-payment.adapter";
import {
  PaymentIntentInput,
  PaymentIntentResult
} from "../../payment.interface";

@Injectable()
export class LocalGatewayAdapter extends BasePaymentAdapter {
  readonly providerCode = "local-country-gateway" as const;

  async initiate(input: PaymentIntentInput): Promise<PaymentIntentResult> {
    return {
      providerReferenceId: `local-${input.orderId}-${Date.now()}`,
      status: "pending",
      paymentUrl: `/pay/local/${input.orderId}`
    };
  }

  async verify(providerReferenceId: string) {
    return providerReferenceId.startsWith("local-");
  }

  async refund() {
    return true;
  }
}

