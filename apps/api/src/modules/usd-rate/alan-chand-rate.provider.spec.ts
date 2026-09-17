import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseAlanChandUsdSellRate } from "./alan-chand-rate.provider";

describe("AlanChand USD rate parser", () => {
  it("extracts the Persian-digit USD sell price", () => {
    const html = `<table><tr title="قیمت دلار آمریکا"><td class="currName">دلار آمریکا</td><td class="buyPrice">۲۳۰,۴۰۰</td><td class="sellPrice text-center">۲۳۲,۷۵۰<span></span></td></tr></table>`;
    assert.equal(parseAlanChandUsdSellRate(html), "232750");
  });

  it("does not confuse another currency with USD", () => {
    assert.throws(
      () => parseAlanChandUsdSellRate(`<tr title="قیمت دلار کانادا"><td class="sellPrice">۱۶۷,۴۰۰</td></tr>`),
      /USD_ROW_NOT_FOUND/
    );
  });

  it("rejects implausible source values", () => {
    assert.throws(
      () => parseAlanChandUsdSellRate(`<tr title="قیمت دلار آمریکا"><td class="sellPrice">۹۹</td></tr>`),
      /USD_RATE_OUT_OF_RANGE/
    );
  });
});
