import { Type } from "class-transformer";
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from "class-validator";

export class ClubHistoryQueryDto {
  @IsOptional() @IsUUID("4") cursor?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100) limit = 25;
}

export class ClubWalletRedeemDto { @IsUUID("4") rewardId!: string; }

export class ClubSettingsDto {
  @IsOptional() @IsBoolean() enabled?: boolean;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100000) pointsPer1000Toman?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100000) tomanPerPoint?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100000) signupPoints?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(0) @Max(100000) firstPurchasePoints?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100000) minRedeemPoints?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100000) maxRedeemPoints?: number;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(3650) expiryDays?: number;
}

export class ClubTierDto {
  @IsString() @MaxLength(100) nameFa!: string;
  @IsString() @MaxLength(100) nameEn!: string;
  @IsString() @MaxLength(100) nameAr!: string;
  @IsString() thresholdToman!: string;
  @Type(() => Number) @IsInt() @Min(0) @Max(1000) sortOrder!: number;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class ClubRewardDto {
  @IsString() @MaxLength(100) nameFa!: string;
  @IsString() @MaxLength(100) nameEn!: string;
  @IsString() @MaxLength(100) nameAr!: string;
  @IsIn(["wallet", "fixed_discount", "percentage_discount"]) kind!: "wallet" | "fixed_discount" | "percentage_discount";
  @Type(() => Number) @IsInt() @Min(1) @Max(1000000) pointsCost!: number;
  @IsString() value!: string;
  @IsOptional() @IsString() maxDiscount?: string;
  @IsOptional() @IsString() minOrder?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class ClubCampaignDto {
  @IsString() @MaxLength(100) nameFa!: string;
  @IsString() @MaxLength(100) nameEn!: string;
  @IsString() @MaxLength(100) nameAr!: string;
  @IsIn(["bonus", "multiplier"]) kind!: "bonus" | "multiplier";
  @IsString() value!: string;
  @IsString() startsAt!: string;
  @IsString() endsAt!: string;
  @IsOptional() @IsUUID("4") minTierId?: string;
  @IsOptional() @IsBoolean() active?: boolean;
}

export class ClubAdjustDto {
  @Type(() => Number) @IsInt() @Min(-1000000) @Max(1000000) points!: number;
  @IsString() @MaxLength(500) reason!: string;
}

export class ClubOverrideDto {
  @IsUUID("4") tierId!: string;
  @IsString() until!: string;
  @IsString() @MaxLength(500) reason!: string;
}
