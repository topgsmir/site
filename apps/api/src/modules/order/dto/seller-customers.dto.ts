import { Type } from "class-transformer";
import { IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength } from "class-validator";
import { USER_REFERENCE_PATTERN } from "../../../common/user-reference";

export class SellerCustomerSearchDto {
  @IsString() @MinLength(3) @MaxLength(100) search!: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(30) limit = 20;
  @IsOptional() @Matches(USER_REFERENCE_PATTERN) cursor?: string;
}

export class SellerCustomerIdDto { @Matches(USER_REFERENCE_PATTERN) id!: string; }

export class SellerCustomerDetailQueryDto {
  @IsOptional() @IsUUID("4") notesCursor?: string;
  @IsOptional() @IsUUID("4") ordersCursor?: string;
}
