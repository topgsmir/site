import { Transform, Type } from "class-transformer";
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested
} from "class-validator";

const trimText = ({ value }: { value: unknown }) =>
  typeof value === "string" ? value.trim() : value;

export class UpdateSellerPublicProfileDto {
  @IsOptional()
  @Transform(trimText)
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  publicName?: string | null;

  @IsOptional()
  @Transform(trimText)
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  specialty?: string | null;

  @IsOptional()
  @Transform(trimText)
  @IsString()
  @MaxLength(1000)
  bio?: string | null;
}

export class PublicSellerQueryDto {
  @IsOptional()
  @IsIn(["fa", "en", "ar"])
  locale?: "fa" | "en" | "ar";
}

export class SellerPageBlockDto {
  @IsUUID("4")
  id!: string;

  @IsIn(["text", "products"])
  type!: "text" | "products";

  @Transform(trimText)
  @IsString()
  @MaxLength(120)
  title!: string;

  @IsOptional()
  @Transform(trimText)
  @IsString()
  @MaxLength(2000)
  body?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(8)
  @IsUUID("4", { each: true })
  productIds?: string[];
}

export class UpdateSellerPageDto {
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => SellerPageBlockDto)
  blocks!: SellerPageBlockDto[];
}

export class SellerPageProductsQueryDto {
  @IsOptional()
  @Transform(trimText)
  @IsString()
  @MaxLength(100)
  search?: string;

  @IsOptional()
  @IsUUID("4")
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit = 20;
}

export class CreateSellerAgentDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  name!: string;

  @IsString()
  @MinLength(2)
  @MaxLength(200)
  specialty!: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 1 })
  @Min(0)
  @Max(5)
  rating!: number;

  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9 -]{7,32}$/)
  phone?: string;

  @IsBoolean()
  available!: boolean;
}

export class CreateSellerInviteDto {
  @IsString()
  @MinLength(2)
  @MaxLength(160)
  ownerName!: string;

  @IsEmail()
  @MaxLength(320)
  ownerEmail!: string;

  @IsString()
  @Matches(/^\+?[0-9 -]{7,32}$/)
  phoneNumber!: string;
}
