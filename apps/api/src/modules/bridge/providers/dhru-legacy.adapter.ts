import { BadGatewayException, Injectable } from "@nestjs/common";
import { SafeHttpService } from "../safe-http.service";
import type { BridgeCredentials, BridgeProviderAdapter, BridgeResult, BridgeSubmitInput, NormalizedBridgeService } from "../bridge.types";
import { array, field, kindFrom, record, string, xml } from "./provider-utils";

@Injectable()
export class DhruLegacyAdapter implements BridgeProviderAdapter {
  constructor(private readonly http: SafeHttpService) {}

  async testConnection(credentials: BridgeCredentials) {
    await this.call(credentials, "imeiservicelist");
  }

  async listServices(credentials: BridgeCredentials) {
    const actions = ["imeiservicelist", "serverservicelist", "fileservicelist"] as const;
    const results = await Promise.allSettled(actions.map((action) => this.call(credentials, action)));
    const services: NormalizedBridgeService[] = [];
    for (let index = 0; index < results.length; index += 1) {
      const result = results[index];
      if (result.status !== "fulfilled") continue;
      const success = record(result.value).SUCCESS;
      for (const root of array(success)) {
        for (const groupValue of array(record(root).LIST ?? root)) {
          const group = record(groupValue);
          for (const serviceValue of array(group.SERVICES ?? group.services)) {
            const service = record(serviceValue);
            const externalId = string(service.SERVICEID ?? service.id);
            const name = string(service.SERVICENAME ?? service.name);
            if (!externalId || !name) continue;
            const kind = kindFrom(service.SERVICETYPE ?? actions[index]);
            const fields = array(service["Requires.Custom"] ?? service.CUSTOMFIELDS)
              .map((item) => field(record(item)))
              .filter((item): item is NonNullable<typeof item> => Boolean(item));
            if (kind === "imei" && !fields.some((item) => item.key.toLowerCase() === "imei")) {
              fields.unshift({ key: "IMEI", label: "IMEI", type: "text", required: true, maximumLength: 100 });
            }
            services.push({
              externalId,
              name,
              groupName: string(group.GROUPNAME ?? group.name) || null,
              kind,
              fields,
              metadata: { serviceType: string(service.SERVICETYPE), time: string(service.TIME) }
            });
          }
        }
      }
    }
    if (!services.length) throw new BadGatewayException("Dhru returned no usable services");
    return services;
  }

  async submitOrder(credentials: BridgeCredentials, input: BridgeSubmitInput): Promise<BridgeResult> {
    const custom = Buffer.from(JSON.stringify(input.fields), "utf8").toString("base64");
    const parameters = input.kind === "imei"
      ? `<PARAMETERS><ID>${xml(input.serviceExternalId)}</ID><IMEI>${xml(input.fields.IMEI ?? input.fields.imei ?? "")}</IMEI></PARAMETERS>`
      : `<PARAMETERS><ID>${xml(input.serviceExternalId)}</ID><QNT>${input.quantity}</QNT><CUSTOMFIELD>${custom}</CUSTOMFIELD></PARAMETERS>`;
    const response = record(await this.call(credentials, input.kind === "imei" ? "placeimeiorder" : input.kind === "file" ? "placefileorder" : "placeserverorder", parameters));
    const first = record(array(response.SUCCESS)[0]);
    const providerReference = string(first.REFERENCEID ?? first.ID);
    if (!providerReference) throw new BadGatewayException("Dhru did not return an order reference");
    return { status: "pending", providerReference };
  }

  async checkOrder(credentials: BridgeCredentials, input: { providerReference: string; kind: "imei" | "server" | "file" }): Promise<BridgeResult> {
    const action = input.kind === "imei" ? "getimeiorder" : input.kind === "file" ? "getfileorder" : "getserverorder";
    const response = record(await this.call(credentials, action, `<PARAMETERS><ID>${xml(input.providerReference)}</ID></PARAMETERS>`));
    const first = record(array(response.SUCCESS)[0]);
    const rawStatus = string(first.STATUS).toLowerCase();
    const status = rawStatus === "4" || rawStatus === "success" ? "success" : rawStatus === "3" || rawStatus === "failed" || rawStatus === "error" ? "failed" : "pending";
    return { status, providerReference: input.providerReference, result: first, ...(status === "failed" ? { diagnosticCode: "PROVIDER_REJECTED" } : {}) };
  }

  private call(credentials: BridgeCredentials, action: string, parameters?: string) {
    const body = new URLSearchParams({
      username: credentials.username,
      apiaccesskey: credentials.apiKey,
      requestformat: "JSON",
      action,
      ...(parameters ? { parameters } : {})
    });
    return this.http.request(credentials.baseUrl, "/api/index.php", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body
    });
  }
}

