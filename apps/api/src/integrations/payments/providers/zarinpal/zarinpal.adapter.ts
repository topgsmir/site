import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException
} from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { BasePaymentAdapter } from "../../base-payment.adapter";
import type {
  PaymentIntentInput,
  PaymentIntentResult
} from "../../payment.interface";

type ZarinpalResponse = {
  data?: {
    code?: number;
    authority?: string;
    ref_id?: number | string;
  };
};

type ZarinpalGraphqlResponse = { data?: { resource?: { id?: string } }; errors?: unknown[] };

@Injectable()
export class ZarinpalAdapter extends BasePaymentAdapter {
  readonly providerCode = "zarinpal" as const;

  constructor(private readonly config: ConfigService) {
    super();
  }

  async initiate(input: PaymentIntentInput): Promise<PaymentIntentResult> {
    this.assertIrr(input.amount, input.currency);
    const result = await this.call(
      "https://payment.zarinpal.com/pg/v4/payment/request.json",
      {
        merchant_id: this.merchantId(),
        amount: Number(input.amount),
        callback_url: this.callbackUrl(),
        description: `TopGSM order ${input.orderId}`,
        metadata: { order_id: input.orderId }
      }
    );
    const authority = result.data?.authority;
    if (result.data?.code !== 100 || !authority) {
      throw new BadGatewayException("Zarinpal rejected the payment request");
    }
    return {
      providerReferenceId: authority,
      status: "pending",
      paymentUrl: `https://www.zarinpal.com/pg/StartPay/${authority}`
    };
  }

  async verify(authority: string, amount: string) {
    this.assertIrr(amount, "IRR");
    const result = await this.call(
      "https://payment.zarinpal.com/pg/v4/payment/verify.json",
      { merchant_id: this.merchantId(), authority, amount: Number(amount) }
    );
    const code = result.data?.code;
    return {
      verified: code === 100 || code === 101,
      ...(result.data?.ref_id !== undefined
        ? { referenceId: String(result.data.ref_id) }
        : {})
    };
  }

  async inquiry(authority: string, amount: string) {
    this.assertIrr(amount, "IRR");
    const result = await this.call(
      "https://payment.zarinpal.com/pg/v4/payment/inquiry.json",
      { merchant_id: this.merchantId(), authority }
    );
    return result.data?.code === 100 || result.data?.code === 101;
  }

  async refund(sessionId: string, amount: string, description: string) {
    this.assertIrr(amount, "IRR");
    const accessToken = this.config
      .get<string>("ZARINPAL_REFUND_ACCESS_TOKEN")
      ?.trim();
    if (!accessToken) {
      throw new ServiceUnavailableException("Zarinpal refunds are not configured");
    }
    const response = await fetch(
      "https://next.zarinpal.com/api/v4/graphql/",
      {
        method: "POST",
        redirect: "error",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({
          query: "mutation AddRefund($session_id: ID!, $amount: BigInteger!, $description: String, $reason: RefundReasonEnum) { resource: AddRefund(session_id: $session_id, amount: $amount, description: $description, reason: $reason) { id } }",
          variables: { session_id: sessionId, amount: Number(amount), description, reason: "CUSTOMER_REQUEST" }
        })
      }
    );
    if (!response.ok) throw new BadGatewayException("Zarinpal refund failed");
    const result = (await response.json()) as ZarinpalGraphqlResponse;
    return Boolean(result.data?.resource?.id) && !result.errors?.length;
  }

  private async call(
    url: string,
    body: Record<string, unknown>
  ): Promise<ZarinpalResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch(url, {
        method: "POST",
        redirect: "error",
        signal: controller.signal,
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body)
      });
      if (!response.ok) {
        throw new BadGatewayException(`Zarinpal returned HTTP ${response.status}`);
      }
      return (await response.json()) as ZarinpalResponse;
    } catch (error) {
      if (error instanceof BadGatewayException) throw error;
      throw new BadGatewayException("Zarinpal request failed");
    } finally {
      clearTimeout(timer);
    }
  }

  private merchantId() {
    const value = this.config.get<string>("ZARINPAL_MERCHANT_ID")?.trim();
    if (!value) {
      throw new ServiceUnavailableException("Zarinpal merchant ID is not configured");
    }
    return value;
  }

  private callbackUrl() {
    const value = this.config.get<string>("ZARINPAL_CALLBACK_URL")?.trim();
    if (!value || !value.startsWith("https://")) {
      throw new ServiceUnavailableException("Zarinpal HTTPS callback URL is not configured");
    }
    return value;
  }

  private assertIrr(amount: string, currency: string) {
    if (
      currency !== "IRR" ||
      !/^[1-9]\d*$/.test(amount) ||
      !Number.isSafeInteger(Number(amount))
    ) {
      throw new BadGatewayException(
        "Zarinpal requires a positive integer IRR amount"
      );
    }
  }
}
