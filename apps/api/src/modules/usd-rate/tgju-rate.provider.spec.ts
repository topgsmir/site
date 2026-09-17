import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseTgjuTetherRate } from "./tgju-rate.provider";

describe("TGJU Tether rate parser", () => {
  it("extracts the labeled rial price and converts it to toman", () => {
    const html = `<tr><td class="text-right">قیمت ریالی</td><td class="text-left">۲,۲۸۲,۵۹۰</td></tr>`;
    assert.equal(parseTgjuTetherRate(html), "228259");
  });

  it("does not confuse TGJU's one-dollar global rate with the rial price", () => {
    assert.throws(
      () => parseTgjuTetherRate(`<span data-col="info.last_trade.PDrCotVal">1</span>`),
      /TETHER_RIAL_PRICE_NOT_FOUND/
    );
  });

  it("rejects implausible rial values", () => {
    assert.throws(
      () => parseTgjuTetherRate(`<tr><td>قیمت ریالی</td><td>۹۹</td></tr>`),
      /USD_RATE_OUT_OF_RANGE/
    );
  });
});
