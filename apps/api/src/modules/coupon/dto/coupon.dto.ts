import { Type } from "class-transformer";
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min
} from "class-validator";

const COUPON_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{2,31}$/;
const CURRENCY_PATTERN = /^[A-Za-z]{3}$/;
const MONEY_PATTERN = /^(?:0|[1-9]\d{0,15})(?:\.\d{1,4})?$/;

export class ListCouponsQueryDto {
  @IsOptional()
  @IsUUID("4")
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;
}

export class CreateCouponDto {
  @IsString()
  @Matches(COUPON_CODE_PATTERN, {
    message: "code must contain 3-32 letters, numbers, underscores, or hyphens"
  })
  code!: string;

  @IsIn(["percentage", "fixed"])
  discountType!: "percentage" | "fixed";

  @IsString()
  @Matches(MONEY_PATTERN)
  discountValue!: string;

  @IsString()
  @Matches(CURRENCY_PATTERN)
  currency!: string;

  @IsOptional()
  @IsString()
  @Matches(MONEY_PATTERN)
  minimumOrderAmount?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1_000_000_000)
  maximumRedemptions?: number;

  @IsOptional()
  @IsISO8601({ strict: true })
  startsAt?: string;

  @IsOptional()
  @IsISO8601({ strict: true })
  expiresAt?: string;

  @IsOptional()
  @IsBoolean()
  active = true;
}
