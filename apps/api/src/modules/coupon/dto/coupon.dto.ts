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
  Min,
  ValidateIf
} from "class-validator";

const COUPON_CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9_-]{2,31}$/;
const CURRENCY_PATTERN = /^TOMAN$/;
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

export class ListAdminCouponsQueryDto extends ListCouponsQueryDto {
  @IsOptional()
  @IsUUID("4")
  sellerId?: string;
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

export class CreateAdminCouponDto extends CreateCouponDto {
  @IsUUID("4")
  sellerId!: string;
}

export class UpdateCouponDto {
  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Matches(COUPON_CODE_PATTERN, {
    message: "code must contain 3-32 letters, numbers, underscores, or hyphens"
  })
  code?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsIn(["percentage", "fixed"])
  discountType?: "percentage" | "fixed";

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Matches(MONEY_PATTERN)
  discountValue?: string;

  @ValidateIf((_object, value) => value !== undefined)
  @IsString()
  @Matches(CURRENCY_PATTERN)
  currency?: string;

  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsString()
  @Matches(MONEY_PATTERN)
  minimumOrderAmount?: string | null;

  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsInt()
  @Min(1)
  @Max(1_000_000_000)
  maximumRedemptions?: number | null;

  @ValidateIf((_object, value) => value !== undefined)
  @IsISO8601({ strict: true })
  startsAt?: string;

  @IsOptional()
  @ValidateIf((_object, value) => value !== null)
  @IsISO8601({ strict: true })
  expiresAt?: string | null;

  @ValidateIf((_object, value) => value !== undefined)
  @IsBoolean()
  active?: boolean;
}
