import assert from "node:assert/strict";
import { it } from "node:test";
import { checkoutShippingSettlement } from "./checkout-shipping-settlement";

it("allocates customer postage to the order while keeping it out of the seller gross", () => {
  const result = checkoutShippingSettlement({ totalAmount: "1300", shippingFee: "300", shippingCost: "300", shippingPayer: "customer", commissionRate: "0.1", holdbackRate: "0.05" });
  assert.deepEqual(Object.fromEntries(Object.entries(result).map(([key, value]) => [key, value.toString()])), {
    gross: "1000", commission: "100", holdback: "50", sellerShippingCost: "0", payable: "850"
  });
});

it("deducts seller postage from the seller payout, while site postage leaves it intact", () => {
  const input = { totalAmount: "1000", shippingFee: "0", shippingCost: "300", commissionRate: "0.1", holdbackRate: "0.05" };
  assert.equal(checkoutShippingSettlement({ ...input, shippingPayer: "seller" }).payable.toString(), "550");
  assert.equal(checkoutShippingSettlement({ ...input, shippingPayer: "site" }).payable.toString(), "850");
  assert.throws(() => checkoutShippingSettlement({ ...input, shippingCost: "900", shippingPayer: "seller" }), /exceeds/i);
});
