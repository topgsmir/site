import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseNobitexUsdtSellRate } from "./nobitex-rate.provider";

describe("Nobitex USDT rate parser", () => {
  it("converts the best ask from rials to toman", () => {
    assert.equal(parseNobitexUsdtSellRate({
      status: "ok",
      asks: [["2278880", "1205.5"], ["2277780", "114.86"]]
    }), "227778");
  });

  it("rejects missing and malformed asks", () => {
    assert.throws(() => parseNobitexUsdtSellRate({ status: "ok", asks: [] }), /ORDERBOOK_ASK_MISSING/);
    assert.throws(() => parseNobitexUsdtSellRate({ status: "ok", asks: [["not-a-price", "1"]] }), /ORDERBOOK_ASK_INVALID/);
  });
});
