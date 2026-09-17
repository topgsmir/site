import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { Prisma } from "../../prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { CreateAdminCouponDto, CreateCouponDto, ListAdminCouponsQueryDto, ListCouponsQueryDto, UpdateCouponDto } from "./dto/coupon.dto";

const couponSelect = {
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
} satisfies Prisma.couponsSelect;

type CouponRecord = Prisma.couponsGetPayload<{ select: typeof couponSelect }>;

const adminCouponSelect = {
  ...couponSelect,
  seller: { select: { id: true, shop_name: true } }
} satisfies Prisma.couponsSelect;

type AdminCouponRecord = Prisma.couponsGetPayload<{ select: typeof adminCouponSelect }>;

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

  async listAdmin(input: ListAdminCouponsQueryDto) {
    const rows = await this.prisma.coupons.findMany({
      where: input.sellerId ? { seller_id: input.sellerId } : undefined,
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      take: input.limit + 1,
      orderBy: [{ updated_at: "desc" }, { id: "desc" }],
      select: adminCouponSelect
    });
    const hasMore = rows.length > input.limit;
    const visible = hasMore ? rows.slice(0, input.limit) : rows;
    return {
      items: visible.map((coupon) => this.toAdminCoupon(coupon)),
      nextCursor: hasMore ? visible[visible.length - 1].id : null
    };
  }

  async create(sellerId: string, input: CreateCouponDto) {
    const coupon = await this.createForSeller(sellerId, input);
    return this.toCoupon(coupon);
  }

  async createAdmin(input: CreateAdminCouponDto) {
    const seller = await this.prisma.sellers.findUnique({
      where: { id: input.sellerId },
      select: { id: true }
    });
    if (!seller) throw new NotFoundException("Seller not found");
    const coupon = await this.createForSeller(input.sellerId, input);
    return this.toAdminCoupon(coupon);
  }

  async updateAdmin(id: string, input: UpdateCouponDto) {
    if (Object.keys(input).length === 0) {
      throw new BadRequestException("At least one coupon field must be provided");
    }

    const current = await this.prisma.coupons.findUnique({
      where: { id },
      select: couponSelect
    });
    if (!current) throw new NotFoundException("Coupon not found");

    const discountType = input.discountType ?? current.discount_type;
    const discountValue = input.discountValue === undefined
      ? current.discount_value
      : new Prisma.Decimal(input.discountValue);
    const minimumOrderAmount = input.minimumOrderAmount === undefined
      ? current.minimum_order_amount
      : input.minimumOrderAmount === null
        ? null
        : new Prisma.Decimal(input.minimumOrderAmount);
    const maximumRedemptions = input.maximumRedemptions === undefined
      ? current.maximum_redemptions
      : input.maximumRedemptions;
    const startsAt = input.startsAt ? new Date(input.startsAt) : current.starts_at;
    const expiresAt = input.expiresAt === undefined
      ? current.expires_at
      : input.expiresAt === null ? null : new Date(input.expiresAt);

    this.assertCouponValues({
      discountType,
      discountValue,
      minimumOrderAmount,
      maximumRedemptions,
      redeemedCount: current.redeemed_count,
      startsAt,
      expiresAt
    });

    try {
      const coupon = await this.prisma.coupons.update({
        where: { id },
        data: {
          ...(input.code === undefined ? {} : {
            code: input.code.normalize("NFKC").trim().toLocaleUpperCase("en-US")
          }),
          ...(input.discountType === undefined ? {} : { discount_type: input.discountType }),
          ...(input.discountValue === undefined ? {} : { discount_value: discountValue }),
          ...(input.currency === undefined ? {} : {
            currency: input.currency.trim().toLocaleUpperCase("en-US")
          }),
          ...(input.minimumOrderAmount === undefined ? {} : { minimum_order_amount: minimumOrderAmount }),
          ...(input.maximumRedemptions === undefined ? {} : { maximum_redemptions: maximumRedemptions }),
          ...(input.startsAt === undefined ? {} : { starts_at: startsAt }),
          ...(input.expiresAt === undefined ? {} : { expires_at: expiresAt }),
          ...(input.active === undefined ? {} : { active: input.active })
        },
        select: adminCouponSelect
      });
      return this.toAdminCoupon(coupon);
    } catch (error) {
      this.translateWriteError(error);
    }
  }

  async deleteAdmin(id: string) {
    const result = await this.prisma.coupons.deleteMany({ where: { id } });
    if (result.count === 0) throw new NotFoundException("Coupon not found");
    return { deleted: true };
  }

  private async createForSeller(sellerId: string, input: CreateCouponDto) {
    const startsAt = input.startsAt ? new Date(input.startsAt) : new Date();
    const expiresAt = input.expiresAt ? new Date(input.expiresAt) : null;
    const discountValue = new Prisma.Decimal(input.discountValue);
    const minimumOrderAmount = input.minimumOrderAmount === undefined
      ? null
      : new Prisma.Decimal(input.minimumOrderAmount);

    this.assertCouponValues({
      discountType: input.discountType,
      discountValue,
      minimumOrderAmount,
      maximumRedemptions: input.maximumRedemptions ?? null,
      redeemedCount: 0,
      startsAt,
      expiresAt
    });

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
        select: adminCouponSelect
      });
      return coupon;
    } catch (error) {
      this.translateWriteError(error);
    }
  }

  private assertCouponValues(input: {
    discountType: "percentage" | "fixed";
    discountValue: Prisma.Decimal;
    minimumOrderAmount: Prisma.Decimal | null;
    maximumRedemptions: number | null;
    redeemedCount: number;
    startsAt: Date;
    expiresAt: Date | null;
  }) {
    if (input.discountValue.lte(0)) {
      throw new BadRequestException("Discount value must be greater than zero");
    }
    if (input.discountType === "percentage" && input.discountValue.gt(100)) {
      throw new BadRequestException("Percentage discount cannot exceed 100");
    }
    if (input.minimumOrderAmount?.lt(0)) {
      throw new BadRequestException("Minimum order amount cannot be negative");
    }
    if (input.maximumRedemptions !== null && input.maximumRedemptions < input.redeemedCount) {
      throw new BadRequestException("Maximum redemptions cannot be below the redeemed count");
    }
    if (input.expiresAt && input.expiresAt <= input.startsAt) {
      throw new BadRequestException("Coupon expiry must be after its start time");
    }
  }

  private translateWriteError(error: unknown): never {
    if (error instanceof Prisma.PrismaClientKnownRequestError) {
      if (error.code === "P2002") {
        throw new ConflictException("This seller already has a coupon with that code");
      }
      if (error.code === "P2025") throw new NotFoundException("Coupon not found");
    }
    throw error;
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

  private toAdminCoupon(coupon: AdminCouponRecord) {
    return {
      ...this.toCoupon(coupon),
      seller: {
        id: coupon.seller.id,
        shopName: coupon.seller.shop_name
      }
    };
  }
}
