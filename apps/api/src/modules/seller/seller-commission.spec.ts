import "reflect-metadata";
import assert from "node:assert/strict";
import { test } from "node:test";
import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";
import { Prisma } from "../../prisma/client";
import { UpdateVendorDto } from "./dto/vendor.dto";
import { assertSellerCommissionRates, sellerCommissionRate } from "./seller-commission";

test("selects a product rate and falls back only when its override is null", () => {
  const seller = {
    commission: new Prisma.Decimal("0.10"),
    commission_digital: new Prisma.Decimal("0"),
    commission_physical: new Prisma.Decimal("0.15"),
    commission_service: null,
    commission_bridge: new Prisma.Decimal("0.25")
  };
  assert.equal(sellerCommissionRate(seller, "digital").toString(), "0");
  assert.equal(sellerCommissionRate(seller, "physical").toString(), "0.15");
  assert.equal(sellerCommissionRate(seller, "service").toString(), "0.1");
  assert.equal(sellerCommissionRate(seller, "bridge").toString(), "0.25");
});

test("rejects commission rates outside the allowed range", () => {
  const seller = {
    commission: new Prisma.Decimal("0.10"),
    commission_digital: null,
    commission_physical: new Prisma.Decimal("0.96"),
    commission_service: null,
    commission_bridge: null
  };
  seller.commission_physical = new Prisma.Decimal("1.01");
  assert.throws(() => assertSellerCommissionRates(seller), /physical products/);
  seller.commission_physical = new Prisma.Decimal("1");
  assert.doesNotThrow(() => assertSellerCommissionRates(seller));
});

test("validates product commission rates within zero and one", async () => {
  const valid = plainToInstance(UpdateVendorDto, { commissionRates: { digital: 0, physical: 1, service: null } });
  assert.deepEqual(await validate(valid), []);
  const invalid = plainToInstance(UpdateVendorDto, { commissionRates: { digital: -0.01, physical: 1.01 } });
  assert.ok((await validate(invalid)).length > 0);
});
