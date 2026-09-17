import { Injectable } from "@nestjs/common";
import { fetchBoundedText, latinDigits, UsdRateFetchError } from "./usd-rate-provider";

export const ALAN_CHAND_SOURCE_URL = "https://alanchand.com/";
const MIN_RATE_TOMAN = 10_000;
const MAX_RATE_TOMAN = 10_000_000;

export { UsdRateFetchError } from "./usd-rate-provider";

export function parseAlanChandUsdSellRate(html: string) {
  const row = html.match(/<tr\b[^>]*\btitle=(?:"قیمت دلار آمریکا"|'قیمت دلار آمریکا')[^>]*>([\s\S]*?)<\/tr>/iu)?.[1];
  if (!row) throw new UsdRateFetchError("USD_ROW_NOT_FOUND");

  const rawRate = row.match(/<td\b[^>]*\bclass=(?:"[^"]*\bsellPrice\b[^"]*"|'[^']*\bsellPrice\b[^']*')[^>]*>\s*([۰-۹٠-٩0-9.,٬]+)/iu)?.[1];
  if (!rawRate) throw new UsdRateFetchError("USD_SELL_PRICE_NOT_FOUND");

  const normalized = latinDigits(rawRate).replace(/[,٬]/g, "");
  if (!/^\d{1,8}(?:\.\d{1,2})?$/.test(normalized)) {
    throw new UsdRateFetchError("USD_RATE_FORMAT_INVALID");
  }
  const numeric = Number(normalized);
  if (!Number.isFinite(numeric) || numeric < MIN_RATE_TOMAN || numeric > MAX_RATE_TOMAN) {
    throw new UsdRateFetchError("USD_RATE_OUT_OF_RANGE");
  }
  return normalized;
}

@Injectable()
export class AlanChandRateProvider {
  readonly id = "alanchand" as const;
  readonly name = "AlanChand";
  readonly sourceUrl = ALAN_CHAND_SOURCE_URL;

  async fetchUsdSellRateToman() {
    const html = await fetchBoundedText(ALAN_CHAND_SOURCE_URL, "text/html;charset=UTF-8", ["text/html"]);
    return parseAlanChandUsdSellRate(html);
  }
}
