import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException
} from "@nestjs/common";
import { BasePaymentAdapter } from "../../base-payment.adapter";
import { PaymentCredentialService } from "../../payment-credential.service";
import type {
  PaymentIntentInput,
  PaymentIntentResult,
  PaymentRefundInput
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
  readonly displayName = "Zarinpal";
  readonly supportedCurrencies = ["IRR"] as const;

  constructor(private readonly credentials: PaymentCredentialService) {
    super();
  }

  async availability() {
    const result = await this.credentials.availability(this.providerCode);
    return {
      available: result?.reason === null,
      unavailabilityReason: result?.reason ?? "missing_merchant_id",
      configuration: result?.configuration ?? null
    };
  }

  paymentUrl(authority: string) {
    return `https://www.zarinpal.com/pg/StartPay/${authority}`;
  }

  async initiate(input: PaymentIntentInput): Promise<PaymentIntentResult> {
    this.assertIrr(input.amount, input.currency);
    const credentials = await this.credentials.zarinpal();
    const result = await this.call(
      "https://payment.zarinpal.com/pg/v4/payment/request.json",
      {
        merchant_id: credentials.merchantId,
        amount: Number(input.amount),
        callback_url: credentials.callbackUrl,
        description: `TopGSM order ${input.orderId} operation ${input.operationId}`,
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
      paymentUrl: this.paymentUrl(authority)
    };
  }

  async verify(authority: string, amount: string) {
    this.assertIrr(amount, "IRR");
    const credentials = await this.credentials.zarinpal();
    const result = await this.call(
      "https://payment.zarinpal.com/pg/v4/payment/verify.json",
      { merchant_id: credentials.merchantId, authority, amount: Number(amount) }
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
    const credentials = await this.credentials.zarinpal();
    const result = await this.call(
      "https://payment.zarinpal.com/pg/v4/payment/inquiry.json",
      { merchant_id: credentials.merchantId, authority }
    );
    return result.data?.code === 100 || result.data?.code === 101;
  }

  async refund(input: PaymentRefundInput) {
    this.assertIrr(input.amount, "IRR");
    const accessToken = (await this.credentials.zarinpal()).refundAccessToken?.trim();
    if (!accessToken) {
      throw new ServiceUnavailableException("Zarinpal refunds are not configured");
    }
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch("https://next.zarinpal.com/api/v4/graphql/", {
        method: "POST",
        redirect: "error",
        signal: controller.signal,
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
          Accept: "application/json"
        },
        body: JSON.stringify({
          query: "mutation AddRefund($session_id: ID!, $amount: BigInteger!, $description: String, $reason: RefundReasonEnum) { resource: AddRefund(session_id: $session_id, amount: $amount, description: $description, reason: $reason) { id } }",
          variables: {
            session_id: input.providerReferenceId,
            amount: Number(input.amount),
            description: `${input.reason.slice(0, 400)} [operation:${input.operationId}]`,
            reason: "CUSTOMER_REQUEST"
          }
        })
      });
      if (!response.ok) throw new BadGatewayException("Zarinpal refund failed");
      const result = (await response.json()) as ZarinpalGraphqlResponse;
      const providerRefundId = result.data?.resource?.id;
      return providerRefundId && !result.errors?.length ? { providerRefundId } : null;
    } catch (error) {
      if (error instanceof BadGatewayException) throw error;
      throw new BadGatewayException("Zarinpal refund request failed");
    } finally {
      clearTimeout(timer);
    }
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
