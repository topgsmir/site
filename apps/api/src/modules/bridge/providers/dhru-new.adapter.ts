import { BadGatewayException, Injectable } from "@nestjs/common";
import { SafeHttpService } from "../safe-http.service";
import type { BridgeCredentials, BridgeProviderAdapter, BridgeResult, BridgeSubmitInput, NormalizedBridgeService } from "../bridge.types";
import { array, field, kindFrom, record, string } from "./provider-utils";

@Injectable()
export class DhruNewAdapter implements BridgeProviderAdapter {
  constructor(private readonly http: SafeHttpService) {}

  async testConnection(credentials: BridgeCredentials) {
    await this.call(credentials, "/api/reseller/v1/account");
  }

  async listServices(credentials: BridgeCredentials) {
    const response = record(await this.call(credentials, "/api/reseller/v1/products/"));
    const products = record(response.data).products;
    const services: NormalizedBridgeService[] = [];
    for (const [fallbackId, value] of Object.entries(record(products))) {
      const service = record(value);
      const externalId = string(service.uuid ?? service.id ?? fallbackId);
      const name = string(service.name);
      if (!externalId || !name) continue;
      const kind = kindFrom(service.type);
      const fields = array(service.fields)
        .map((item) => field(record(item)))
        .filter((item): item is NonNullable<typeof item> => Boolean(item));
      if (kind === "imei" && !fields.some((item) => item.key.toLowerCase() === "imei")) {
        fields.unshift({ key: "IMEI", label: "IMEI", type: "text", required: true, maximumLength: 100 });
      }
      services.push({ externalId, name, groupName: string(service.group ?? service.category) || null, kind, fields, metadata: { type: service.type ?? null } });
    }
    if (!services.length) throw new BadGatewayException("Dhru returned no usable services");
    return services;
  }

  async submitOrder(credentials: BridgeCredentials, input: BridgeSubmitInput): Promise<BridgeResult> {
    const response = record(await this.call(credentials, "/api/reseller/v1/order", {
      method: "POST",
      body: JSON.stringify([{ product_uuid: input.serviceExternalId, fields: { ...input.fields, Quantity: input.quantity } }])
    }));
    const first = record(array(response.data)[0]);
    const providerReference = string(first.order_uuid ?? first.id);
    if (!providerReference) throw new BadGatewayException("Dhru did not return an order reference");
    return { status: "pending", providerReference };
  }

  async checkOrder(credentials: BridgeCredentials, input: { providerReference: string; kind: "imei" | "server" | "file" }): Promise<BridgeResult> {
    const response = record(await this.call(credentials, `/api/reseller/v1/order?order_uuid=${encodeURIComponent(input.providerReference)}`));
    const data = Array.isArray(response.data) ? record(response.data[0]) : record(response.data);
    const rawStatus = string(data.status ?? response.status).toLowerCase();
    const status = ["success", "completed", "done", "4"].includes(rawStatus) ? "success" : ["failed", "error", "rejected", "3"].includes(rawStatus) ? "failed" : "pending";
    return { status, providerReference: input.providerReference, result: data, ...(status === "failed" ? { diagnosticCode: "PROVIDER_REJECTED" } : {}) };
  }

  private call(credentials: BridgeCredentials, path: string, init: RequestInit = {}) {
    return this.http.request(credentials.baseUrl, path, {
      ...init,
      method: init.method ?? "GET",
      headers: {
        Authorization: `Bearer ${credentials.apiKey}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers
      }
    });
  }
}

