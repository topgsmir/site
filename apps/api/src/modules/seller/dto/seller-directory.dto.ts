import { Type } from "class-transformer";
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
