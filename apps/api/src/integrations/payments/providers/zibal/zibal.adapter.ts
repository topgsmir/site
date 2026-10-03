import { BadGatewayException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { readBoundedJsonResponse } from "../../../../common/http/bounded-json-response";
import { BasePaymentAdapter } from "../../base-payment.adapter";
import { PaymentCredentialService } from "../../payment-credential.service";
import type { PaymentIntentInput, PaymentRefundInput } from "../../payment.interface";

type ZibalResponse = {
  result: number;
  status?: number;
  trackId?: string;
  amount?: string;
  refNumber?: string;
};

@Injectable()
export class ZibalAdapter extends BasePaymentAdapter {
  readonly providerCode = "zibal" as const;
  readonly displayName = "Zibal";
  readonly supportedCurrencies = ["TOMAN"] as const;
  readonly supportsRefunds = false;

  constructor(private readonly credentials: PaymentCredentialService) {
    super();
  }

  async availability() {
    const result = await this.credentials.availability(this.providerCode);
    return {
      available: result?.reason === null,
      unavailabilityReason: result?.reason ?? "missing_merchant_id" as const,
      configuration: result?.configuration ?? null
    };
  }

  paymentUrl(trackId: string) {
    return this.validTrackId(trackId) ? `https://gateway.zibal.ir/start/${trackId}` : undefined;
  }

  async initiate(input: PaymentIntentInput) {
    const amount = this.toRials(input.amount, input.currency);
    const { merchantId, callbackUrl } = await this.credentials.zibal();
    const result = await this.call("request", {
      merchant: merchantId,
      amount,
      callbackUrl,
      orderId: input.operationId,
      description: `TopGSM order ${input.orderId}`
    });
    if (result.result !== 100 || !result.trackId) {
      throw new BadGatewayException("Zibal rejected the payment request");
    }
    return {
      providerReferenceId: result.trackId,
      status: "pending" as const,
      paymentUrl: this.paymentUrl(result.trackId)
    };
  }

  async verify(trackId: string, amount: string) {
    if (!this.validTrackId(trackId)) throw new BadGatewayException("Invalid Zibal track ID");
    const expectedAmount = this.toRials(amount, "TOMAN");
    const { merchantId } = await this.credentials.zibal();
    let result = await this.call("verify", { merchant: merchantId, trackId: Number(trackId) });
    if (result.result === 201) {
      result = await this.inquire(trackId, amount);
      if (result.status !== 1) throw new ServiceUnavailableException("Zibal reconciliation is required");
    }
    if (result.result === 202) return { verified: false };
    if (result.result !== 100) throw new BadGatewayException("Zibal could not verify the payment");
    if (result.amount !== String(expectedAmount)) {
      throw new BadGatewayException("Zibal verified a different payment amount");
    }
    return {
      verified: true,
      ...(result.refNumber ? { referenceId: result.refNumber } : {})
    };
  }

  // Provider contract: https://help.zibal.ir/ipg/ (inquiry result and payment status are distinct).
  async inquiry(trackId: string, amount: string): Promise<boolean | null> {
    const result = await this.inquire(trackId, amount);
    if (result.status === 1 || result.status === 2) return true;
    if (result.status === 3 || result.status === 15 || result.status === 18) return false;
    return null;
  }

  private async inquire(trackId: string, amount: string) {
    if (!this.validTrackId(trackId)) throw new BadGatewayException("Invalid Zibal track ID");
    const { merchantId } = await this.credentials.zibal();
    const result = await this.call("inquiry", { merchant: merchantId, trackId: Number(trackId) });
    if (result.result !== 100) throw new BadGatewayException("Zibal inquiry was not successful");
    if (result.amount !== String(this.toRials(amount, "TOMAN"))) throw new BadGatewayException("Zibal reported a different payment amount");
    return result;
  }

  async refund(_input: PaymentRefundInput): Promise<null> {
    throw new ServiceUnavailableException("Zibal refunds are not supported");
  }

  private validTrackId(value: string) {
    return /^[1-9]\d{0,15}$/.test(value) && Number.isSafeInteger(Number(value));
  }

  private toRials(amount: string, currency: string) {
    const match = /^([1-9]\d*)(?:\.(\d))?$/.exec(amount);
    const rials = match ? BigInt(match[1]!) * 10n + BigInt(match[2] ?? "0") : 0n;
    if (currency !== "TOMAN" || !match || rials > BigInt(Number.MAX_SAFE_INTEGER)) {
      throw new BadGatewayException("Zibal requires a positive exact rial amount");
    }
    return Number(rials);
  }

  private async call(path: "request" | "verify" | "inquiry", body: Record<string, unknown>): Promise<ZibalResponse> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch(`https://gateway.zibal.ir/v1/${path}`, {
        method: "POST",
        redirect: "error",
        signal: controller.signal,
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body)
      });
      if (!response.ok) throw new BadGatewayException("Zibal request failed");
      return this.parseResponse(await readBoundedJsonResponse(response));
    } catch (error) {
      if (error instanceof BadGatewayException) throw error;
      throw new BadGatewayException("Zibal request failed");
    } finally {
      clearTimeout(timer);
    }
  }

  private parseResponse(value: unknown): ZibalResponse {
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      throw new BadGatewayException("Zibal returned an invalid response");
    }
    const response = value as Record<string, unknown>;
    if (typeof response.result !== "number" || !Number.isSafeInteger(response.result)) {
      throw new BadGatewayException("Zibal returned an invalid result");
    }
    const numericString = (field: unknown, maxLength: number) => {
      if (field === undefined || field === null) return undefined;
      const value = typeof field === "number" && Number.isSafeInteger(field) && field >= 0
        ? String(field) : typeof field === "string" ? field : "";
      if (!new RegExp(`^\\d{1,${maxLength}}$`).test(value)) {
        throw new BadGatewayException("Zibal returned an invalid response");
      }
      return value;
    };
    if (response.status !== undefined && (typeof response.status !== "number" || !Number.isSafeInteger(response.status))) {
      throw new BadGatewayException("Zibal returned an invalid payment status");
    }
    const trackId = numericString(response.trackId, 16);
    if (trackId && !this.validTrackId(trackId)) throw new BadGatewayException("Zibal returned an invalid track ID");
    const refNumber = response.refNumber === undefined || response.refNumber === null
      ? undefined
      : typeof response.refNumber === "number" && Number.isSafeInteger(response.refNumber) && response.refNumber >= 0
        ? String(response.refNumber)
        : response.refNumber;
    if (refNumber !== undefined && (typeof refNumber !== "string" || !/^[A-Za-z0-9_-]{1,64}$/.test(refNumber))) {
      throw new BadGatewayException("Zibal returned an invalid reference number");
    }
    return {
      result: response.result,
      status: response.status as number | undefined,
      trackId,
      amount: numericString(response.amount, 16),
      refNumber
    };
  }
}
