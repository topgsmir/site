import { Type } from "class-transformer";
import { IsBoolean, IsInt, IsNumber, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength } from "class-validator";

export class UpdateShippingSettingsDto {
  @IsString()
  @MinLength(4)
  @MaxLength(200)
  apiKey!: string;
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

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(-90)
  @Max(90)
  latitude!: number;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 8 })
  @Min(-180)
  @Max(180)
  longitude!: number;
}

export class ListShippingPlacesDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  senderName!: string;

  @IsString()
  @Matches(/^(?:\+98|0098|98|0)?9\d{9}$/)
  senderMobile!: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  provinceId?: number;
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
