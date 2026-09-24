import type { AdminShippingSettings, ShippingPlaceOption } from "@topgsm/shared-types";

export type ShippingProviderJson = string | number | boolean | null | ShippingProviderJson[] | { [key: string]: ShippingProviderJson };
export type ShippingProviderState = Record<string, ShippingProviderJson>;

export type ShippingOrigin = {
  shopName: string;
  senderName: string;
  senderMobile: string;
  province: string;
  city: string;
  addressLine: string;
  postalCode: string;
  latitude: number;
  longitude: number;
};

export type ShippingOrderInput = {
  dispatchId: number;
  recipientName: string;
  recipientMobile: string;
  recipientProvince: string;
  recipientCity: string;
  recipientAddress: string;
  recipientPostalCode: string;
  currency: string;
  totalAmount: string;
  items: Array<{ title: string; quantity: number; weightGrams: number }>;
};

export type ShippingTracking = {
  providerTrackingCode: string | null;
  courierTrackingCode: string | null;
  courierTitle: string | null;
};

export interface ShippingProvider {
  readonly code: string;
  readonly displayName: string;
  getSettings(): Promise<AdminShippingSettings>;
  configureApiKey(apiKey: string, actorUserId: string): Promise<AdminShippingSettings>;
  isConfigured(): Promise<boolean>;
  credentialFingerprint(): Promise<string>;
  isTenantAccountReady(state: ShippingProviderState): boolean;
  isTenantReady(state: ShippingProviderState): boolean;
  ensureTenantAccount(input: {
    sellerId: string;
    senderName: string;
    senderMobile: string;
    state: ShippingProviderState;
    checkpoint: (state: ShippingProviderState, accountReference: string | null) => Promise<void>;
  }): Promise<{ state: ShippingProviderState; accountReference: string | null }>;
  listPlaces(input: { tenantState: ShippingProviderState; provinceId?: number }): Promise<ShippingPlaceOption[]>;
  provisionTenant(input: {
    sellerId: string;
    origin: ShippingOrigin;
    state: ShippingProviderState;
    profileChanged: boolean;
    checkpoint: (state: ShippingProviderState, accountReference: string | null) => Promise<void>;
  }): Promise<{ state: ShippingProviderState; accountReference: string | null }>;
  createShipment(input: {
    origin: ShippingOrigin;
    tenantState: ShippingProviderState;
    order: ShippingOrderInput;
  }): Promise<{ providerOrderReference: string }>;
  findTracking(input: {
    tenantState: ShippingProviderState;
    recipientMobile: string;
    dispatchId: number;
  }): Promise<ShippingTracking | null>;
}
