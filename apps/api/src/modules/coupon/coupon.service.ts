import {
  BadRequestException,
  ConflictException,
  Injectable
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { CreateCouponDto, ListCouponsQueryDto } from "./dto/coupon.dto";

const couponSelect = Prisma.validator<Prisma.couponsSelect>()({
  id: true,
  code: true,
  discount_type: true,
  discount_value: true,
  currency: true,
  minimum_order_amount: true,
  maximum_redemptions: true,
  redeemed_count: true,
  starts_at: true,
  expires_at: true,
  active: true,
  created_at: true,
  updated_at: true
});

type CouponRecord = Prisma.couponsGetPayload<{ select: typeof couponSelect }>;

@Injectable()
export class CouponService {
  constructor(private readonly prisma: PrismaService) {}

  async listMine(sellerId: string, input: ListCouponsQueryDto) {
    const rows = await this.prisma.coupons.findMany({
      where: { seller_id: sellerId },
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      take: input.limit + 1,
      orderBy: [{ updated_at: "desc" }, { id: "desc" }],
      select: couponSelect
    });
    const hasMore = rows.length > input.limit;
    const visible = hasMore ? rows.slice(0, input.limit) : rows;

    return {
      items: visible.map((coupon) => this.toCoupon(coupon)),
      nextCursor: hasMore ? visible[visible.length - 1].id : null
    };
  }

  async create(sellerId: string, input: CreateCouponDto) {
    const startsAt = input.startsAt ? new Date(input.startsAt) : new Date();
    const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
    const discountValue = new Prisma.Decimal(input.discountValue);
    const minimumOrderAmount = input.minimumOrderAmount === undefined
      ? null
      : new Prisma.Decimal(input.minimumOrderAmount);

    if (discountValue.lte(0)) {
      throw new BadRequestException("Discount value must be greater than zero");
    }
    if (input.discountType === "percentage" && discountValue.gt(100)) {
      throw new BadRequestException("Percentage discount cannot exceed 100");
    }
    if (minimumOrderAmount?.lt(0)) {
      throw new BadRequestException("Minimum order amount cannot be negative");
    }
    if (expiresAt && expiresAt <= startsAt) {
      throw new BadRequestException("Coupon expiry must be after its start time");
    }

    try {
      const coupon = await this.prisma.coupons.create({
        data: {
          seller_id: sellerId,
          code: input.code.normalize("NFKC").trim().toLocaleUpperCase("en-US"),
          discount_type: input.discountType,
          discount_value: discountValue,
          currency: input.currency.trim().toLocaleUpperCase("en-US"),
          minimum_order_amount: minimumOrderAmount,
          maximum_redemptions: input.maximumRedemptions,
          starts_at: startsAt,
          expires_at: expiresAt,
          active: input.active
        },
        select: couponSelect
      });
      return this.toCoupon(coupon);
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        throw new ConflictException("This seller already has a coupon with that code");
      }
      throw error;
    }
  }

  private toCoupon(coupon: CouponRecord) {
    return {
      id: coupon.id,
      code: coupon.code,
      discountType: coupon.discount_type,
      discountValue: coupon.discount_value.toString(),
      currency: coupon.currency.trim(),
      minimumOrderAmount: coupon.minimum_order_amount?.toString() ?? null,
      maximumRedemptions: coupon.maximum_redemptions,
      redeemedCount: coupon.redeemed_count,
      startsAt: coupon.starts_at.toISOString(),
      expiresAt: coupon.expires_at?.toISOString() ?? null,
      active: coupon.active,
      createdAt: coupon.created_at.toISOString(),
      updatedAt: coupon.updated_at.toISOString()
    };
  }
}
