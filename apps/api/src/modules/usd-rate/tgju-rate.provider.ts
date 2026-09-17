import { Injectable } from "@nestjs/common";
import { Prisma } from "../../prisma/client";
import { fetchBoundedText, latinDigits, UsdRateFetchError } from "./usd-rate-provider";

export const TGJU_SOURCE_URL = "https://www.tgju.org/profile/crypto-tether";
const MIN_RATE_TOMAN = new Prisma.Decimal(10_000);
const MAX_RATE_TOMAN = new Prisma.Decimal(10_000_000);
const TGJU_MAX_RESPONSE_BYTES = 1536 * 1024;

export function parseTgjuTetherRate(html: string) {
  const rawRate = html.match(
    /<td\b[^>]*>\s*قیمت\s+ریالی\s*<\/td>\s*<td\b[^>]*>\s*([۰-۹٠-٩0-9,٬]+)\s*<\/td>/iu
  )?.[1];
  if (!rawRate) throw new UsdRateFetchError("TETHER_RIAL_PRICE_NOT_FOUND");

  const normalized = latinDigits(rawRate).replace(/[,٬]/g, "");
  if (!/^\d{1,12}$/.test(normalized)) throw new UsdRateFetchError("TETHER_RIAL_PRICE_INVALID");

  // TGJU labels this field as a rial price; TopGSM stores toman.
  const rateToman = new Prisma.Decimal(normalized).div(10);
  if (rateToman.lt(MIN_RATE_TOMAN) || rateToman.gt(MAX_RATE_TOMAN)) {
    throw new UsdRateFetchError("USD_RATE_OUT_OF_RANGE");
  }
  return rateToman.toDecimalPlaces(2).toString();
}

@Injectable()
export class TgjuRateProvider {
  readonly id = "tgju" as const;
  readonly name = "TGJU";
  readonly sourceUrl = TGJU_SOURCE_URL;

  async fetchUsdSellRateToman() {
    const html = await fetchBoundedText(
      TGJU_SOURCE_URL,
      "text/html;charset=UTF-8",
      ["text/html"],
      TGJU_MAX_RESPONSE_BYTES
    );
    return parseTgjuTetherRate(html);
  }
}
