import { Injectable } from "@nestjs/common";
import type { AdminUsdRateProviderQuote, UsdRateProviderId } from "@topgsm/shared-types";
import { AlanChandRateProvider } from "./alan-chand-rate.provider";
import { NobitexRateProvider } from "./nobitex-rate.provider";
import { TgjuRateProvider } from "./tgju-rate.provider";
import { UsdRateFetchError, type UsdRateProvider } from "./usd-rate-provider";

export const USD_RATE_PROVIDER_IDS = ["alanchand", "nobitex", "tgju"] as const satisfies readonly UsdRateProviderId[];
const QUOTE_CACHE_MS = 5 * 60_000;

@Injectable()
export class UsdRateProviderRegistry {
  private cachedQuotes?: { expiresAt: number; value: Promise<AdminUsdRateProviderQuote[]> };

  constructor(
    private readonly alanChand: AlanChandRateProvider,
    private readonly nobitex: NobitexRateProvider,
    private readonly tgju: TgjuRateProvider
  ) {}

  get(id: UsdRateProviderId): UsdRateProvider {
    if (id === "alanchand") return this.alanChand;
    if (id === "nobitex") return this.nobitex;
    if (id === "tgju") return this.tgju;
    throw new UsdRateFetchError("PROVIDER_UNSUPPORTED");
  }

  getSourceUrl(id: UsdRateProviderId) {
    return this.get(id).sourceUrl;
  }

  async getQuotes(): Promise<AdminUsdRateProviderQuote[]> {
    const now = Date.now();
    if (this.cachedQuotes && this.cachedQuotes.expiresAt > now) return this.cachedQuotes.value;
    const value = Promise.all([this.quote(this.alanChand), this.quote(this.nobitex), this.quote(this.tgju)]);
    this.cachedQuotes = { expiresAt: now + QUOTE_CACHE_MS, value };
    return value;
  }

  clearQuoteCache() {
    this.cachedQuotes = undefined;
  }

  private async quote(provider: UsdRateProvider): Promise<AdminUsdRateProviderQuote> {
    try {
      return {
        id: provider.id,
        name: provider.name,
        sourceUrl: provider.sourceUrl,
        rateToman: await provider.fetchUsdSellRateToman(),
        status: "available",
        errorCode: null
      };
    } catch (error) {
      return {
        id: provider.id,
        name: provider.name,
        sourceUrl: provider.sourceUrl,
        rateToman: null,
        status: "unavailable",
        errorCode: error instanceof UsdRateFetchError ? error.code : "UNEXPECTED_FETCH_ERROR"
      };
    }
  }
}
