import { IsBoolean, IsInt, IsOptional, IsString, Matches, Max, MaxLength, Min, MinLength } from "class-validator";

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

  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(200)
  senderName?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^(?:\+98|0098|98|0)?9\d{9}$/)
  senderMobile?: string | null;

  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  productType!: number;

  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  packageType!: number;
}
