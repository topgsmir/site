import { Type } from "class-transformer";
import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength } from "class-validator";

export class UpdateShippingSettingsDto {
  @IsBoolean()
  enabled!: boolean;

  @IsOptional()
  @IsString()
  @MinLength(4)
  @MaxLength(200)
  clientCode?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  userId?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  storeId?: number | null;

  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  productType!: number;

  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  packageType!: number;
}

export class UpdateSellerShippingProfileDto {
  @IsBoolean()
  enabled!: boolean;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  senderName!: string;

  @IsString()
  @Matches(/^(?:\+98|0098|98|0)?9\d{9}$/)
  senderMobile!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  province!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(100)
  city!: string;

  @IsString()
  @MinLength(5)
  @MaxLength(500)
  addressLine!: string;

  @IsString()
  @Matches(/^\d{10}$/)
  postalCode!: string;
}

export class ListSellerShippingProfilesDto {
  @IsOptional()
  @IsUUID("4")
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  search?: string;
}
