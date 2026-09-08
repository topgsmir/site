import { ForbiddenException, Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { BasePaymentAdapter } from "../../base-payment.adapter";
import {
  PaymentIntentInput,
  PaymentIntentResult
} from "../../payment.interface";

@Injectable()
export class LocalGatewayAdapter extends BasePaymentAdapter implements OnModuleInit {
  readonly providerCode = "local-country-gateway" as const;

  constructor(private readonly config: ConfigService) {
    super();
  }

  onModuleInit() {
    if (this.config.get<string>("NODE_ENV") === "production" && this.config.get<string>("LOCAL_PAYMENT_GATEWAY_ENABLED") === "true") {
      throw new ForbiddenException("The local payment gateway cannot be enabled in production");
    }
  }

  async initiate(input: PaymentIntentInput): Promise<PaymentIntentResult> {
    this.assertDevelopment();
    return {
      providerReferenceId: `local-${input.orderId}-${Date.now()}`,
      status: "pending",
      paymentUrl: `/pay/local/${input.orderId}`
    };
  }

  async verify(providerReferenceId: string) {
    this.assertDevelopment();
    return {
      verified: providerReferenceId.startsWith("local-"),
      referenceId: providerReferenceId
    };
  }

  async refund() {
    this.assertDevelopment();
    return true;
  }

  private assertDevelopment() {
    if ((this.config.get<string>("NODE_ENV") ?? "development") === "production") {
      throw new ForbiddenException("The local payment gateway is disabled in production");
    }
  }
}

