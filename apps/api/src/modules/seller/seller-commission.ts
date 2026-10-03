import { BadRequestException } from "@nestjs/common";
import { Prisma } from "../../prisma/client";
import type { ProductType } from "@topgsm/shared-types";

type SellerCommission = {
  commission: Prisma.Decimal;
  commission_digital: Prisma.Decimal | null;
  commission_physical: Prisma.Decimal | null;
  commission_service: Prisma.Decimal | null;
  commission_bridge: Prisma.Decimal | null;
};

export function sellerCommissionRate(seller: SellerCommission, type: ProductType): Prisma.Decimal {
  switch (type) {
    case "digital": return seller.commission_digital ?? seller.commission;
    case "physical": return seller.commission_physical ?? seller.commission;
    case "service": return seller.commission_service ?? seller.commission;
    case "bridge": return seller.commission_bridge ?? seller.commission;
  }
}

export function assertSellerCommissionRates(seller: SellerCommission): void {
  for (const type of ["digital", "physical", "service", "bridge"] as const) {
    const rate = sellerCommissionRate(seller, type);
    if (rate.lessThan(0) || rate.greaterThan(1)) {
      throw new BadRequestException(`Commission must be between 0 and 100% for ${type} products`);
    }
  }
}
