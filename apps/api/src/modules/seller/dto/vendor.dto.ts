import { Type } from "class-transformer";
import {
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength
} from "class-validator";

export const vendorPermissions = [
  "products_manage",
  "products_publish",
  "blog_manage",
  "coupons_manage",
  "orders_manage",
  "staff_manage",
  "analytics_view",
  "payouts_request"
] as const;

export const vendorStatuses = ["invited", "active", "suspended"] as const;

type VendorPermission = (typeof vendorPermissions)[number];
type VendorStatus = (typeof vendorStatuses)[number];

export class CreateVendorDto {
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  ownerName!: string;

  @IsEmail()
  @MaxLength(254)
  ownerEmail!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(120)
  shopName!: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phoneNumber?: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;

  @IsEnum(vendorStatuses)
  status!: VendorStatus;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(1)
  commission!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(1)
  holdbackRate!: number;

  @IsArray()
  @ArrayUnique()
  @IsEnum(vendorPermissions, { each: true })
  permissions!: VendorPermission[];

  @IsOptional()
  @IsBoolean()
  blogReviewRequired?: boolean;
}

export class UpdateVendorDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  ownerName?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(254)
  ownerEmail?: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  shopName?: string;

  @IsOptional()
  @IsString()
  @MaxLength(32)
  phoneNumber?: string;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password?: string;

  @IsOptional()
  @IsEnum(vendorStatuses)
  status?: VendorStatus;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(1)
  commission?: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 4 })
  @Min(0)
  @Max(1)
  holdbackRate?: number;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(vendorPermissions, { each: true })
  permissions?: VendorPermission[];

  @IsOptional()
  @IsBoolean()
  blogReviewRequired?: boolean;
}
