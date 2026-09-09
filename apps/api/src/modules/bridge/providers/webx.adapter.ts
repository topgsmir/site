import { BadGatewayException, Injectable } from "@nestjs/common";
import { SafeHttpService } from "../safe-http.service";
import type { BridgeCredentials, BridgeProviderAdapter, BridgeResult, BridgeSubmitInput, NormalizedBridgeService } from "../bridge.types";
import { array, field, record, string } from "./provider-utils";
import { WebxAuthKeyService } from "./webx-auth-key.service";

@Injectable()
export class WebxAdapter implements BridgeProviderAdapter {
  constructor(
    private readonly http: SafeHttpService,
    private readonly authKeys: WebxAuthKeyService
  ) {}

  async testConnection(credentials: BridgeCredentials) {
    await this.call(credentials, "");
  }

  async listServices(credentials: BridgeCredentials) {
    const authKey = await this.authKeys.create(credentials);
    const routes = [
      { route: "imei-services", kind: "imei" as const },
      { route: "server-services", kind: "server" as const },
      { route: "file-services", kind: "file" as const }
    ];
    const results = await Promise.allSettled(
      routes.map(({ route }) => this.call(credentials, route, {}, authKey))
    );
    const services: NormalizedBridgeService[] = [];
    for (let index = 0; index < results.length; index += 1) {
      const result = results[index];
      if (result.status !== "fulfilled") continue;
      for (const value of array(result.value)) {
        const service = record(value);
        const externalId = string(service.id);
        const name = string(service.name);
        if (!externalId || !name) continue;
        const fields = array(service.fields)
          .map((item) => field(record(item)))
          .filter((item): item is NonNullable<typeof item> => Boolean(item));
        const mainField = service.main_field && typeof service.main_field === "object" ? field(record(service.main_field), true) : null;
        if (mainField && !fields.some((item) => item.key === mainField.key)) fields.unshift(mainField);
        services.push({
          externalId,
          name,
          groupName: string(service.group) || null,
          kind: routes[index].kind,
          fields,
          metadata: { calculationType: service.type ?? null, allowDuplicates: service.allow_duplicates ?? false }
        });
      }
    }
    if (!services.length) throw new BadGatewayException("WebX returned no usable services");
    return services;
  }

  async submitOrder(credentials: BridgeCredentials, input: BridgeSubmitInput): Promise<BridgeResult> {
    if (input.kind === "file") throw new BadGatewayException("WebX file uploads require manual fulfillment in this release");
    const route = input.kind === "imei" ? "imei-orders" : "server-orders";
    const body = new URLSearchParams({
      service_id: input.serviceExternalId,
      ...(input.kind === "imei" ? { device: input.fields.IMEI ?? input.fields.device ?? "" } : { quantity: String(input.quantity) }),
      ...input.fields
    });
    const response = record(await this.call(credentials, route, { method: "POST", body }));
    const providerReference = string(response.id);
    if (!providerReference) throw new BadGatewayException("WebX did not return an order reference");
    return { status: "pending", providerReference };
  }

  async checkOrder(credentials: BridgeCredentials, input: { providerReference: string; kind: "imei" | "server" | "file" }): Promise<BridgeResult> {
    const route = input.kind === "imei" ? "imei-orders" : input.kind === "file" ? "file-orders" : "server-orders";
    const response = record(await this.call(credentials, `${route}/${encodeURIComponent(input.providerReference)}`));
    const rawStatus = string(response.status).toLowerCase();
    const status = ["success", "completed", "done", "4"].includes(rawStatus) ? "success" : ["failed", "error", "rejected", "3"].includes(rawStatus) ? "failed" : "pending";
    return { status, providerReference: input.providerReference, result: response, ...(status === "failed" ? { diagnosticCode: "PROVIDER_REJECTED" } : {}) };
  }

  private async call(
    credentials: BridgeCredentials,
    route: string,
    init: RequestInit = {},
    authKey?: string
  ) {
    const body = init.body instanceof URLSearchParams ? init.body : new URLSearchParams();
    if (init.method === "POST") body.set("username", credentials.username);
    const query = init.method === "POST" ? "" : `${route.includes("?") ? "&" : "?"}username=${encodeURIComponent(credentials.username)}`;
    return this.http.request(credentials.baseUrl, `/api/${route}${query}`, {
      ...init,
      headers: {
        "Auth-Key": authKey ?? await this.authKeys.create(credentials),
        ...(init.method === "POST" ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
        ...init.headers
      },
      ...(init.method === "POST" ? { body } : {})
    });
  }
}
