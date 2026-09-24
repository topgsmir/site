import { BadGatewayException, ConflictException, Injectable } from "@nestjs/common";
import { createHash } from "node:crypto";
import { Prisma } from "../../../prisma/client";
import type { ShippingOrderInput, ShippingOrigin, ShippingProvider, ShippingProviderState, ShippingTracking } from "../shipping-provider";
import { AmadastAdapter } from "./amadast.adapter";
import { AmadastSettingsService } from "./amadast-settings.service";
import type { AmadastConfig } from "./amadast.types";

const PRODUCT_TYPE = 1;
const PACKAGE_TYPE = 1;

@Injectable()
export class AmadastShippingProvider implements ShippingProvider {
  readonly code = "amadast";
  readonly displayName = "Amadast";

  constructor(
    private readonly settings: AmadastSettingsService,
    private readonly amadast: AmadastAdapter
  ) {}

  getSettings() { return this.settings.get(); }
  configureApiKey(apiKey: string, actorUserId: string) { return this.settings.updateApiKey(apiKey, actorUserId); }
  isConfigured() { return this.settings.isEnabled(); }

  async credentialFingerprint() {
    const { clientCode } = await this.settings.effective();
    return createHash("sha256").update(clientCode).digest("hex");
  }

  isTenantAccountReady(state: ShippingProviderState) {
    return Boolean(this.positiveInteger(state.userId));
  }

  isTenantReady(state: ShippingProviderState) {
    return Boolean(this.positiveInteger(state.userId) && this.positiveInteger(state.locationId) && this.positiveInteger(state.storeId));
  }

  async ensureTenantAccount(input: {
    sellerId: string;
    senderName: string;
    senderMobile: string;
    state: ShippingProviderState;
    checkpoint: (state: ShippingProviderState, accountReference: string | null) => Promise<void>;
  }) {
    const { clientCode } = await this.settings.effective();
    return this.ensureAccount(clientCode, input);
  }

  async listPlaces(input: { tenantState: ShippingProviderState; provinceId?: number }) {
    const userId = this.positiveInteger(input.tenantState.userId);
    if (!userId) throw new BadGatewayException("The Amadast seller account is incomplete");
    const { clientCode } = await this.settings.effective();
    return this.amadast.listPlaces({ clientCode, userId }, input.provinceId);
  }

  async provisionTenant(input: {
    sellerId: string;
    origin: ShippingOrigin;
    state: ShippingProviderState;
    profileChanged: boolean;
    checkpoint: (state: ShippingProviderState, accountReference: string | null) => Promise<void>;
  }) {
    const { clientCode } = await this.settings.effective();
    const state: ShippingProviderState = input.profileChanged && this.positiveInteger(input.state.userId)
      ? {
        userId: this.positiveInteger(input.state.userId)!,
        ...(typeof input.state.accountMobileHash === "string" ? { accountMobileHash: input.state.accountMobileHash } : {})
      }
      : { ...input.state };
    const account = await this.ensureAccount(clientCode, {
      sellerId: input.sellerId,
      senderName: input.origin.senderName,
      senderMobile: input.origin.senderMobile,
      state,
      checkpoint: input.checkpoint
    });
    Object.assign(state, account.state);
    const userId = this.positiveInteger(state.userId)!;

    const tenantConfig = { clientCode, userId };
    const suffix = `${input.sellerId.slice(0, 8)}-${this.originFingerprint(input.origin).slice(0, 12)}`;
    const locationTitle = `TopGSM-${suffix}`;
    let locationId = this.positiveInteger(state.locationId);
    if (!locationId) {
      locationId = await this.amadast.findLocation(tenantConfig, locationTitle)
        ?? await this.amadast.createLocation(tenantConfig, {
          title: locationTitle,
          address: input.origin.addressLine,
          province: input.origin.province,
          city: input.origin.city,
          postalCode: input.origin.postalCode,
          latitude: input.origin.latitude,
          longitude: input.origin.longitude
        });
      state.locationId = locationId;
      await input.checkpoint(state, String(userId));
    }

    const storeTitle = `${input.origin.shopName.slice(0, 120)} — TG-${suffix}`;
    let storeId = this.positiveInteger(state.storeId);
    if (!storeId) {
      storeId = await this.amadast.findStore(tenantConfig, storeTitle)
        ?? await this.amadast.createStore(tenantConfig, {
          title: storeTitle,
          locationId,
          adminName: input.origin.senderName,
          phone: input.origin.senderMobile
        });
      state.storeId = storeId;
      await input.checkpoint(state, String(userId));
    }
    return { state, accountReference: String(userId) };
  }

  async createShipment(input: { origin: ShippingOrigin; tenantState: ShippingProviderState; order: ShippingOrderInput }) {
    const config = await this.config(input.tenantState);
    const recipientMobile = this.iranianMobile(input.order.recipientMobile);
    if (!recipientMobile) throw new ConflictException("The shipping phone number is invalid for Amadast");
    const providerValue = new Prisma.Decimal(input.order.totalAmount).mul(10);
    if (input.order.currency.trim() !== "TOMAN" || !providerValue.isInteger() || providerValue.lt(10_000) || providerValue.gt(2_147_483_647)) {
      throw new ConflictException("The order value is outside Amadast limits");
    }
    const weight = input.order.items.reduce((sum, item) => sum + item.weightGrams * item.quantity, 0);
    if (!Number.isSafeInteger(weight) || weight < 10) throw new ConflictException("Physical offer weights must total at least 10 grams");
    const result = await this.amadast.createOrder(config, input.order.recipientProvince, input.order.recipientCity, {
      store_id: config.storeId,
      external_order_id: input.order.dispatchId,
      recipient_name: input.order.recipientName,
      sender_name: input.origin.senderName,
      recipient_mobile: recipientMobile,
      sender_mobile: input.origin.senderMobile,
      recipient_address: input.order.recipientAddress,
      weight,
      value: providerValue.toNumber(),
      product_type: config.productType,
      package_type: config.packageType,
      recipient_postal_code: input.order.recipientPostalCode,
      description: input.order.items.map((item) => `${item.title} × ${item.quantity}`).join("، ").slice(0, 500),
      is_breakable: false,
      is_liquid: false,
      is_big: false
    });
    return { providerOrderReference: String(result.providerOrderId) };
  }

  async findTracking(input: { tenantState: ShippingProviderState; recipientMobile: string; dispatchId: number }): Promise<ShippingTracking | null> {
    const mobile = this.iranianMobile(input.recipientMobile);
    if (!mobile) throw new ConflictException("The shipping phone number is invalid for Amadast");
    const tracking = await this.amadast.findTracking(await this.config(input.tenantState), mobile, input.dispatchId);
    return tracking ? {
      providerTrackingCode: tracking.amadastTrackingCode,
      courierTrackingCode: tracking.courierTrackingCode,
      courierTitle: tracking.courierTitle
    } : null;
  }

  private async config(state: ShippingProviderState): Promise<AmadastConfig> {
    const userId = this.positiveInteger(state.userId);
    const storeId = this.positiveInteger(state.storeId);
    if (!userId || !storeId) throw new BadGatewayException("The Amadast seller tenant is incomplete");
    const { clientCode } = await this.settings.effective();
    return { clientCode, userId, storeId, productType: PRODUCT_TYPE, packageType: PACKAGE_TYPE };
  }

  private async ensureAccount(clientCode: string, input: {
    sellerId: string;
    senderName: string;
    senderMobile: string;
    state: ShippingProviderState;
    checkpoint: (state: ShippingProviderState, accountReference: string | null) => Promise<void>;
  }) {
    const state = { ...input.state };
    const mobile = this.iranianMobile(input.senderMobile);
    if (!mobile) throw new ConflictException("The sender phone number is invalid for Amadast");
    const mobileHash = createHash("sha256").update(mobile).digest("hex");
    let userId = this.positiveInteger(state.userId);
    if (!userId || (typeof state.accountMobileHash === "string" && state.accountMobileHash !== mobileHash)) {
      userId = await this.amadast.createUser(clientCode, input.senderName.normalize("NFKC").trim(), mobile);
      state.userId = userId;
      state.accountMobileHash = mobileHash;
      await input.checkpoint(state, String(userId));
    } else if (state.accountMobileHash !== mobileHash) {
      state.accountMobileHash = mobileHash;
      await input.checkpoint(state, String(userId));
    }
    return { state, accountReference: String(userId) };
  }

  private positiveInteger(value: unknown) {
    return typeof value === "number" && Number.isSafeInteger(value) && value > 0 ? value : null;
  }

  private iranianMobile(value: string | null | undefined) {
    const digits = value?.replace(/\D/g, "") ?? "";
    const normalized = digits.startsWith("0098") ? `0${digits.slice(4)}` : digits.startsWith("98") ? `0${digits.slice(2)}` : digits;
    return /^09\d{9}$/.test(normalized) ? normalized : null;
  }

  private originFingerprint(origin: ShippingOrigin) {
    return createHash("sha256").update(JSON.stringify(origin)).digest("hex");
  }
}
