import { BadGatewayException, Injectable, UnprocessableEntityException } from "@nestjs/common";
import { SafeHttpService } from "../../../common/http/safe-http.service";
import type { AmadastConfig, AmadastLocationInput, AmadastOrderPayload, AmadastPlace, AmadastStoreInput, AmadastTenantConfig, AmadastTracking } from "./amadast.types";

const BASE_URL = "https://shop-integration.amadast.com";

@Injectable()
export class AmadastAdapter {
  constructor(private readonly http: SafeHttpService) {}

  async createUser(clientCode: string, fullName: string, mobile: string) {
    const response = record(await this.http.request(BASE_URL, "/v1/users", {
      method: "POST",
      headers: { ...this.headers({ clientCode }), "Content-Type": "application/json" },
      body: JSON.stringify({ full_name: fullName, mobile })
    }));
    const userId = integer(record(response.data).id);
    if (!userId) throw new BadGatewayException("Amadast did not return a user reference");
    return userId;
  }

  async createLocation(config: AmadastTenantConfig, input: AmadastLocationInput) {
    const token = await this.accessToken(config);
    const place = await this.resolvePlace(config, token, input.province, input.city);
    const response = record(await this.call(config, token, "/v1/locations", {
      method: "POST",
      body: JSON.stringify({
        title: input.title,
        address: input.address,
        province_id: place.provinceId,
        city_id: place.cityId,
        postal_code: input.postalCode,
        latitude: input.latitude,
        longitude: input.longitude
      })
    }));
    const locationId = integer(record(response.data).id);
    if (!locationId) throw new BadGatewayException("Amadast did not return a location reference");
    return locationId;
  }

  async findLocation(config: AmadastTenantConfig, title: string) {
    const token = await this.accessToken(config);
    return this.findByTitle(config, token, "/v1/locations", title);
  }

  async createStore(config: AmadastTenantConfig, input: AmadastStoreInput) {
    const token = await this.accessToken(config);
    const response = record(await this.call(config, token, "/v1/stores", {
      method: "POST",
      body: JSON.stringify({ title: input.title, location_id: input.locationId, admin_name: input.adminName, phone: input.phone })
    }));
    const storeId = integer(record(response.data).id);
    if (!storeId) throw new BadGatewayException("Amadast did not return a store reference");
    return storeId;
  }

  async findStore(config: AmadastTenantConfig, title: string) {
    const token = await this.accessToken(config);
    return this.findByTitle(config, token, "/v1/stores", title);
  }

  async listPlaces(config: AmadastTenantConfig, provinceId?: number): Promise<AmadastPlace[]> {
    const token = await this.accessToken(config);
    return this.cities(config, token, provinceId);
  }

  async createOrder(config: AmadastConfig, province: string, city: string, payload: Omit<AmadastOrderPayload, "recipient_city_id">) {
    const token = await this.accessToken(config);
    const { cityId } = await this.resolvePlace(config, token, province, city);
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
    for (let page = 1; page <= 100; page += 1) {
      const response = record(await this.call(
        config,
        token,
        `/v1/orders/search?phone_number=${encodeURIComponent(phoneNumber)}&page=${page}&per_page=100`
      ));
      const items = array(response.data);
      for (const value of items) {
        const item = record(value);
        if (integer(item.external_order_id) !== externalOrderId) continue;
        return {
          externalOrderId,
          amadastTrackingCode: optionalString(item.amadast_tracking_code),
          courierTrackingCode: optionalString(item.courier_tracking_code),
          courierTitle: optionalString(item.courier_title)
        };
      }
      if (items.length < 100) return null;
    }
    throw new BadGatewayException("Amadast order lookup exceeded the pagination limit");
  }

  private async accessToken(config: Pick<AmadastConfig, "clientCode" | "userId">) {
    const response = record(await this.http.request(
      BASE_URL,
      `/v1/auth/token/${config.userId}`,
      { method: "POST", headers: this.headers(config) }
    ));
    const token = optionalString(record(response.data).access_token);
    if (!token || token.length > 8_192) throw new BadGatewayException("Amadast did not return a valid access token");
    return token;
  }

  private async resolvePlace(config: Pick<AmadastConfig, "clientCode">, token: string, provinceName: string, cityName: string) {
    const provinces = await this.cities(config, token);
    const province = provinces.find((item) => normalizePlaceName(item.title) === normalizePlaceName(provinceName));
    if (!province) throw new UnprocessableEntityException("The shipping province is not supported by Amadast");
    const cities = await this.cities(config, token, province.id);
    const city = cities.find((item) => normalizePlaceName(item.title) === normalizePlaceName(cityName));
    if (!city) throw new UnprocessableEntityException("The shipping city is not supported by Amadast");
    return { provinceId: province.id, cityId: city.id };
  }

  private async cities(config: Pick<AmadastConfig, "clientCode">, token: string, provinceId?: number) {
    const response = record(await this.call(config, token, `/v1/cities${provinceId ? `?province_id=${provinceId}` : ""}`));
    return array(response.data).map((value) => {
      const item = record(value);
      return { id: integer(item.id), title: optionalString(item.title), parentId: integer(item.parent) };
    }).filter((item): item is AmadastPlace => Boolean(item.id && item.title));
  }

  private async findByTitle(config: AmadastTenantConfig, token: string, path: string, title: string) {
    for (let page = 1; page <= 100; page += 1) {
      const response = record(await this.call(config, token, `${path}?page=${page}&per_page=50`));
      const items = array(response.data);
      for (const value of items) {
        const item = record(value);
        if (optionalString(item.title) === title) return integer(item.id);
      }
      if (items.length < 50) return null;
    }
    throw new BadGatewayException("Amadast resource lookup exceeded the pagination limit");
  }

  private call(config: Pick<AmadastConfig, "clientCode">, token: string, path: string, init: RequestInit = {}) {
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

  private headers(config: Pick<AmadastConfig, "clientCode">) {
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
