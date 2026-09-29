import { Type } from "class-transformer";
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength } from "class-validator";

export class WalletHistoryQueryDto {
  @IsOptional() @IsUUID("4") cursor?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit = 20;
}

export class WalletTopupDto {
  @IsString() @Matches(/^[1-9]\d{3,8}$/) amount!: string;
  @IsIn(["zarinpal", "zibal"]) provider!: string;
}

export class WalletAdjustmentDto {
  @IsString() @Matches(/^-?[1-9]\d{0,7}$/) amount!: string;
  @IsString() @MinLength(10) @MaxLength(500) reason!: string;
  @IsString() @MinLength(3) @MaxLength(128) reference!: string;
}

export class WalletRefundDto {
  @IsString() @MinLength(10) @MaxLength(500) reason!: string;
}
