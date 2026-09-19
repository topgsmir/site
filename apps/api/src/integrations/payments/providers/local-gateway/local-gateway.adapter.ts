import { ForbiddenException, Injectable, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { BasePaymentAdapter } from "../../base-payment.adapter";
import {
  PaymentIntentInput,
  PaymentIntentResult,
  PaymentRefundInput
} from "../../payment.interface";

@Injectable()
export class LocalGatewayAdapter extends BasePaymentAdapter implements OnModuleInit {
  readonly providerCode = "local-country-gateway" as const;
  readonly displayName = "Local test gateway";
  readonly supportedCurrencies = ["IRR"] as const;

  constructor(private readonly config: ConfigService) {
    super();
  }

  onModuleInit() {
    if (this.config.get<string>("NODE_ENV") === "production" && this.config.get<string>("LOCAL_PAYMENT_GATEWAY_ENABLED") === "true") {
      throw new ForbiddenException("The local payment gateway cannot be enabled in production");
    }
  }

  async availability() {
    const available = (this.config.get<string>("NODE_ENV") ?? "development") !== "production";
    return { available, unavailabilityReason: available ? null : "development_only" as const, configuration: null };
  }

  paymentUrl(providerReferenceId: string) {
    return /^local-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(providerReferenceId) ? `/pay/local/${providerReferenceId}` : undefined;
  }

  async initiate(input: PaymentIntentInput): Promise<PaymentIntentResult> {
    this.assertDevelopment();
    return {
      providerReferenceId: `local-${input.operationId}`,
      status: "pending",
      paymentUrl: `/pay/local/local-${input.operationId}`
    };
  }

  async verify(providerReferenceId: string) {
    this.assertDevelopment();
    return {
      verified: this.paymentUrl(providerReferenceId) !== undefined,
      referenceId: providerReferenceId
    };
  }

  async refund(input: PaymentRefundInput) {
    this.assertDevelopment();
    return { providerRefundId: `local-refund-${input.operationId}` };
  }

  private assertDevelopment() {
    if ((this.config.get<string>("NODE_ENV") ?? "development") === "production") {
      throw new ForbiddenException("The local payment gateway is disabled in production");
    }
  }
}

