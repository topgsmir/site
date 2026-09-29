import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsDefined, IsIn, IsInt, IsISO8601, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, ValidateNested } from "class-validator";

export class ShippingPolicyRuleDto {
  @IsIn(["customer", "seller", "site"])
  payer!: "customer" | "seller" | "site";

  @IsString()
  @Matches(/^(?:0|[1-9]\d{0,11})$/)
  flatRateToman!: string;

  @IsOptional()
  @IsString()
  @Matches(/^(?:0|[1-9]\d{0,11})$/)
  freeAboveToman!: string | null;

  @IsArray()
  @ArrayMaxSize(31)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  allowedProvinces!: string[];

  @IsOptional() @IsInt() @Min(10) @Max(2_000_000) maxWeightGrams!: number | null;
  @IsOptional() @IsInt() @Min(1) @Max(1_000) maxLengthCm!: number | null;
  @IsOptional() @IsInt() @Min(1) @Max(1_000) maxWidthCm!: number | null;
  @IsOptional() @IsInt() @Min(1) @Max(1_000) maxHeightCm!: number | null;
}

export class SellerShippingRuleDto {
  @IsUUID("4") sellerId!: string;
  @IsDefined() @ValidateNested() @Type(() => ShippingPolicyRuleDto) rule!: ShippingPolicyRuleDto;
}

export class UpdateShippingPolicyDto {
  @IsOptional() @IsISO8601({ strict: true }) updatedAt!: string | null;
  @IsDefined() @ValidateNested() @Type(() => ShippingPolicyRuleDto) defaultRule!: ShippingPolicyRuleDto;
  @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => SellerShippingRuleDto)
  sellerRules!: SellerShippingRuleDto[];
}
