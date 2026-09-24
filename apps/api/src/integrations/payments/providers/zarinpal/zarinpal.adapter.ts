import {
  BadGatewayException,
  Injectable,
  ServiceUnavailableException
} from "@nestjs/common";
import { readBoundedJsonResponse } from "../../../../common/http/bounded-json-response";
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
  readonly supportedCurrencies = ["TOMAN"] as const;

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
    const rialAmount = this.toProviderRials(input.amount, input.currency);
    const credentials = await this.credentials.zarinpal();
    const result = await this.call(
      "https://payment.zarinpal.com/pg/v4/payment/request.json",
      {
        merchant_id: credentials.merchantId,
        amount: rialAmount,
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
    const rialAmount = this.toProviderRials(amount, "TOMAN");
    const credentials = await this.credentials.zarinpal();
    const result = await this.call(
      "https://payment.zarinpal.com/pg/v4/payment/verify.json",
      { merchant_id: credentials.merchantId, authority, amount: rialAmount }
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
    this.toProviderRials(amount, "TOMAN");
    const credentials = await this.credentials.zarinpal();
    const result = await this.call(
      "https://payment.zarinpal.com/pg/v4/payment/inquiry.json",
      { merchant_id: credentials.merchantId, authority }
    );
    return result.data?.code === 100 || result.data?.code === 101;
  }

  async refund(input: PaymentRefundInput) {
    const rialAmount = this.toProviderRials(input.amount, "TOMAN");
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
            amount: rialAmount,
            description: `${input.reason.slice(0, 400)} [operation:${input.operationId}]`,
            reason: "CUSTOMER_REQUEST"
          }
        })
      });
      if (!response.ok) throw new BadGatewayException("Zarinpal refund failed");
      const result = parseGraphqlResponse(await readBoundedJsonResponse(response));
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
      return parseZarinpalResponse(await readBoundedJsonResponse(response));
    } catch (error) {
      if (error instanceof BadGatewayException) throw error;
      throw new BadGatewayException("Zarinpal request failed");
    } finally {
      clearTimeout(timer);
    }
  }

  private toProviderRials(amount: string, currency: string) {
    const match = /^([1-9]\d*)(?:\.(\d))?$/.exec(amount);
    const rials = match ? BigInt(match[1]!) * 10n + BigInt(match[2] ?? "0") : 0n;
    if (
      currency !== "TOMAN" ||
      !match ||
      rials > BigInt(Number.MAX_SAFE_INTEGER)
    ) {
      throw new BadGatewayException(
        "Zarinpal requires a positive integer toman amount"
      );
    }
    return Number(rials);
  }
}

function parseZarinpalResponse(value: unknown): ZarinpalResponse {
  const root = record(value);
  const data = root.data === undefined ? undefined : record(root.data);
  const code = data?.code;
  const authority = data?.authority;
  const referenceId = data?.ref_id;
  if (
    (code !== undefined && (!Number.isSafeInteger(code) || typeof code !== "number")) ||
    (authority !== undefined && (typeof authority !== "string" || !/^[A-Za-z0-9-]{1,128}$/.test(authority))) ||
    (referenceId !== undefined && !(
      typeof referenceId === "number" && Number.isSafeInteger(referenceId) && referenceId >= 0 ||
      typeof referenceId === "string" && /^\d{1,128}$/.test(referenceId)
    ))
  ) throw new BadGatewayException("Zarinpal returned an invalid response");
  return { data: data ? { code: code as number | undefined, authority: authority as string | undefined, ref_id: referenceId as number | string | undefined } : undefined };
}

function parseGraphqlResponse(value: unknown): ZarinpalGraphqlResponse {
  const root = record(value);
  const data = root.data === undefined ? undefined : record(root.data);
  const resource = data?.resource === undefined || data.resource === null ? undefined : record(data.resource);
  const id = resource?.id;
  if (id !== undefined && (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,200}$/.test(id))) {
    throw new BadGatewayException("Zarinpal returned an invalid refund response");
  }
  if (root.errors !== undefined && (!Array.isArray(root.errors) || root.errors.length > 100)) {
    throw new BadGatewayException("Zarinpal returned an invalid refund response");
  }
  return {
    data: data ? { resource: resource ? { id: id as string | undefined } : undefined } : undefined,
    errors: root.errors as unknown[] | undefined
  };
}

function record(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new BadGatewayException("Zarinpal returned an invalid response");
  }
  return value as Record<string, unknown>;
}
