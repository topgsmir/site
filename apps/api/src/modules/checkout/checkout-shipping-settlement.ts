import { ConflictException } from "@nestjs/common";
import type { ShippingPayer } from "@topgsm/shared-types";
import { Prisma } from "../../prisma/client";

export function checkoutShippingSettlement(input: {
  totalAmount: string;
  shippingFee: string;
  shippingCost: string;
  shippingPayer: ShippingPayer | null;
  commissionRate: string;
  holdbackRate: string;
}) {
  const gross = new Prisma.Decimal(input.totalAmount).minus(input.shippingFee);
  const commission = gross.mul(input.commissionRate).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
  const holdback = gross.mul(input.holdbackRate).toDecimalPlaces(0, Prisma.Decimal.ROUND_HALF_UP);
  const sellerShippingCost = input.shippingPayer === "seller" ? new Prisma.Decimal(input.shippingCost) : new Prisma.Decimal(0);
  const payable = gross.minus(commission).minus(holdback).minus(sellerShippingCost);
  if (gross.isNegative() || payable.isNegative()) throw new ConflictException("Seller shipping cost exceeds the order payout");
  return { gross, commission, holdback, sellerShippingCost, payable };
}
