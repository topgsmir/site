import { Type } from "class-transformer";
import {
  ArrayUnique,
  IsArray,
  IsEmail,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength
} from "class-validator";

export const platformPermissions = [
  "vendors_manage",
  "catalog_view",
  "orders_manage",
  "payouts_manage",
  "blog_manage"
] as const;

export class CreateStaffInvitationDto {
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  fullName!: string;

  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsArray()
  @ArrayUnique()
  @IsEnum(platformPermissions, { each: true })
  permissions!: Array<(typeof platformPermissions)[number]>;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(168)
  expiresInHours?: number;
}

export class UpdateStaffDto {
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  fullName?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(platformPermissions, { each: true })
  permissions?: Array<(typeof platformPermissions)[number]>;
}

export class CompleteStaffSetupDto {
  @IsString()
  @MinLength(12)
  @MaxLength(128)
  password!: string;
}
