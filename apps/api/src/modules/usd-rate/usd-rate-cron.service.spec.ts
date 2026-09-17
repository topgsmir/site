import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { Prisma } from "../../prisma/client";
import { assertReasonableRateChange } from "./usd-rate-cron.service";

describe("USD rate change guard", () => {
  it("allows ordinary market movement and the initial rate", () => {
    assert.doesNotThrow(() => assertReasonableRateChange(null, new Prisma.Decimal("232000")));
    assert.doesNotThrow(() => assertReasonableRateChange(new Prisma.Decimal("232000"), new Prisma.Decimal("240000")));
  });

  it("rejects a source jump greater than 25 percent", () => {
    assert.throws(
      () => assertReasonableRateChange(new Prisma.Decimal("232000"), new Prisma.Decimal("400000")),
      /USD_RATE_CHANGE_TOO_LARGE/
    );
  });
});
