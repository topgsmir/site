import { Transform, Type } from "class-transformer";
import {
  IsBoolean,
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength
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
