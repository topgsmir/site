import { Injectable } from "@nestjs/common";
import { Prisma } from "../../prisma/client";
import { fetchBoundedText, UsdRateFetchError } from "./usd-rate-provider";

export const NOBITEX_SOURCE_URL = "https://apiv2.nobitex.ir/v3/orderbook/USDTIRT";
const MIN_RATE_TOMAN = new Prisma.Decimal(10_000);
const MAX_RATE_TOMAN = new Prisma.Decimal(10_000_000);

interface NobitexOrderBook {
  status?: unknown;
  asks?: unknown;
}

export function parseNobitexUsdtSellRate(payload: unknown) {
  if (!payload || typeof payload !== "object") throw new UsdRateFetchError("ORDERBOOK_FORMAT_INVALID");
  const { status, asks } = payload as NobitexOrderBook;
  if (status !== "ok") throw new UsdRateFetchError("ORDERBOOK_STATUS_INVALID");
  if (!Array.isArray(asks) || asks.length === 0) throw new UsdRateFetchError("ORDERBOOK_ASK_MISSING");

  const prices = asks.map((ask) => {
    if (!Array.isArray(ask) || typeof ask[0] !== "string" || !/^\d{1,12}(?:\.\d{1,2})?$/.test(ask[0])) {
      throw new UsdRateFetchError("ORDERBOOK_ASK_INVALID");
    }
    return new Prisma.Decimal(ask[0]);
  });

  // Nobitex's IRT order book currently expresses prices in rials; TopGSM stores toman.
  const rateToman = Prisma.Decimal.min(...prices).div(10);
  if (rateToman.lt(MIN_RATE_TOMAN) || rateToman.gt(MAX_RATE_TOMAN)) {
    throw new UsdRateFetchError("USD_RATE_OUT_OF_RANGE");
  }
  return rateToman.toDecimalPlaces(2).toString();
}

@Injectable()
export class NobitexRateProvider {
  readonly id = "nobitex" as const;
  readonly name = "Nobitex";
  readonly sourceUrl = NOBITEX_SOURCE_URL;

  async fetchUsdSellRateToman() {
    const body = await fetchBoundedText(NOBITEX_SOURCE_URL, "application/json", ["application/json"]);
    let payload: unknown;
    try {
      payload = JSON.parse(body);
    } catch {
      throw new UsdRateFetchError("SOURCE_JSON_INVALID");
    }
    return parseNobitexUsdtSellRate(payload);
  }
}
