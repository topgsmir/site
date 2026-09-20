import { Type } from "class-transformer";
import { IsEmail, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength } from "class-validator";

const roles = ["all", "buyer", "seller_admin", "seller_staff", "platform_staff", "platform_admin"] as const;
export const historySections = ["orders", "checkouts", "payments", "entitlements", "comments", "communications", "sessions", "seller", "ai", "activity", "profile", "related"] as const;
export type HistorySection = typeof historySections[number];

export class UserIdDto { @IsUUID("4") id!: string; }

export class ListAdminUsersQueryDto {
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @IsIn(roles) role: typeof roles[number] = "all";
  @IsOptional() @IsIn(["newest", "oldest", "name", "orders"]) sort: "newest" | "oldest" | "name" | "orders" = "newest";
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;
  @IsOptional() @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) joinedFrom?: string;
  @IsOptional() @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/) joinedTo?: string;
  @IsOptional() @IsIn(["all", "yes", "no"]) hasOrders: "all" | "yes" | "no" = "all";
  @IsOptional() @IsIn(["all", "yes", "no"]) hasPhone: "all" | "yes" | "no" = "all";
}

export class AdminUserHistoryQueryDto {
  @IsIn(historySections) section!: HistorySection;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(100000) page = 1;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(30) limit = 20;
}

export class UpdateAdminUserDto {
  @IsOptional() @IsString() @MinLength(2) @MaxLength(100) fullName?: string;
  @IsOptional() @IsEmail() @MaxLength(254) email?: string;
  @IsOptional() @IsString() @Matches(/^[a-z0-9_]{3,32}$/) username?: string | null;
  @IsOptional() @IsString() @Matches(/^\+?[0-9]{8,15}$/) phoneNumber?: string | null;
}
