import { ArrayMaxSize, ArrayUnique, IsArray, IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from "class-validator";
import type { ManagedUserRole } from "@topgsm/shared-types";
import { platformPermissions } from "../../staff/dto/staff.dto";
import { USER_REFERENCE_PATTERN } from "../../../common/user-reference";

export class LifecycleReasonDto {
  @IsString() @MinLength(3) @MaxLength(500) reason!: string;
}
export class ChangeAccountStatusDto extends LifecycleReasonDto {
  @IsIn(["active", "blocked"]) status!: "active" | "blocked";
}
export class ChangeUserRoleDto extends LifecycleReasonDto {
  @IsIn(["buyer", "seller_staff", "seller_admin", "platform_staff", "platform_admin"]) role!: ManagedUserRole;
  @IsOptional() @IsUUID("4") sellerId?: string;
  @IsOptional() @IsArray() @ArrayUnique() @ArrayMaxSize(6) @IsIn(platformPermissions, { each: true })
  permissions?: (typeof platformPermissions)[number][];
  @IsOptional() @IsString() @MinLength(1) @MaxLength(128) currentPassword?: string;
  @IsOptional() @IsString() @MaxLength(254) confirmation?: string;
}
export class DeletionQueryDto {
  @IsOptional() @Matches(USER_REFERENCE_PATTERN) replacementUserId?: string;
}
export class CreateDeletionDto extends LifecycleReasonDto {
  @IsOptional() @Matches(USER_REFERENCE_PATTERN) replacementUserId?: string;
  @IsUUID("4") idempotencyKey!: string;
  @IsString() @MinLength(1) @MaxLength(128) currentPassword!: string;
  @IsString() @MinLength(1) @MaxLength(254) confirmation!: string;
}
export class LifecycleSearchDto {
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @IsUUID("4") cursor?: string;
}

export class LifecycleCandidateSearchDto {
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @Matches(USER_REFERENCE_PATTERN) cursor?: string;
}
