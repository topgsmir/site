import { BadGatewayException, Injectable, UnprocessableEntityException } from "@nestjs/common";
import { SafeHttpService } from "../../../common/http/safe-http.service";
import type { AmadastConfig, AmadastOrderPayload, AmadastTracking } from "./amadast.types";

const BASE_URL = "https://shop-integration.amadast.com";

@Injectable()
export class AmadastAdapter {
  constructor(private readonly http: SafeHttpService) {}

  async createOrder(config: AmadastConfig, province: string, city: string, payload: Omit<AmadastOrderPayload, "recipient_city_id">) {
    const token = await this.accessToken(config);
    const cityId = await this.resolveCity(config, token, province, city);
    const response = record(await this.call(config, token, "/v1/orders", {
      method: "POST",
      body: JSON.stringify({ ...payload, recipient_city_id: cityId })
    }));
    const providerOrderId = integer(record(response.data).id);
    if (!providerOrderId) throw new BadGatewayException("Amadast did not return an order reference");
    return { providerOrderId };
  }

  async findTracking(config: AmadastConfig, phoneNumber: string, externalOrderId: number): Promise<AmadastTracking | null> {
    const token = await this.accessToken(config);
    const response = record(await this.call(
      config,
      token,
      `/v1/orders/search?phone_number=${encodeURIComponent(phoneNumber)}&page=1&per_page=100`
    ));
    for (const value of array(response.data)) {
      const item = record(value);
      if (integer(item.external_order_id) !== externalOrderId) continue;
      return {
        externalOrderId,
        amadastTrackingCode: optionalString(item.amadast_tracking_code),
        courierTrackingCode: optionalString(item.courier_tracking_code),
        courierTitle: optionalString(item.courier_title)
      };
    }
    return null;
  }

  private async accessToken(config: AmadastConfig) {
    const response = record(await this.http.request(
      BASE_URL,
      `/v1/auth/token/${config.userId}`,
      { method: "POST", headers: this.headers(config) }
    ));
    const token = optionalString(record(response.data).access_token);
    if (!token || token.length > 8_192) throw new BadGatewayException("Amadast did not return a valid access token");
    return token;
  }

  private async resolveCity(config: AmadastConfig, token: string, provinceName: string, cityName: string) {
    const provinces = await this.cities(config, token);
    const province = provinces.find((item) => normalizePlaceName(item.title) === normalizePlaceName(provinceName));
    if (!province) throw new UnprocessableEntityException("The shipping province is not supported by Amadast");
    const cities = await this.cities(config, token, province.id);
    const city = cities.find((item) => normalizePlaceName(item.title) === normalizePlaceName(cityName));
    if (!city) throw new UnprocessableEntityException("The shipping city is not supported by Amadast");
    return city.id;
  }

  private async cities(config: AmadastConfig, token: string, provinceId?: number) {
    const response = record(await this.call(config, token, `/v1/cities${provinceId ? `?province_id=${provinceId}` : ""}`));
    return array(response.data).map((value) => {
      const item = record(value);
      return { id: integer(item.id), title: optionalString(item.title) };
    }).filter((item): item is { id: number; title: string } => Boolean(item.id && item.title));
  }

  private call(config: AmadastConfig, token: string, path: string, init: RequestInit = {}) {
    return this.http.request(BASE_URL, path, {
      ...init,
      method: init.method ?? "GET",
      headers: {
        ...this.headers(config),
        Authorization: `Bearer ${token}`,
        ...(init.body ? { "Content-Type": "application/json" } : {}),
        ...init.headers
      }
    });
  }

  private headers(config: AmadastConfig) {
    return { Accept: "application/json", "X-Client-Code": config.clientCode };
  }
}

export function normalizePlaceName(value: string) {
  return value.normalize("NFKC")
    .replace(/[يى]/g, "ی")
    .replace(/ك/g, "ک")
    .replace(/[\u200c\u200f\u202a-\u202e]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^(?:استان|شهر)\s+/u, "")
    .toLocaleLowerCase("fa");
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

function array(value: unknown): unknown[] { return Array.isArray(value) ? value : []; }

function integer(value: unknown) {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
}

function optionalString(value: unknown) {
  if (typeof value !== "string") return null;
  const normalized = value.trim();
  return normalized || null;
}
