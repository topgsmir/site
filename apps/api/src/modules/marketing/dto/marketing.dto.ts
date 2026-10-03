import { IsBoolean, IsIn, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from "class-validator";

export class CreateMarketingLinkDto {
  @IsUUID("4") productId!: string;
  @IsOptional() @IsUUID("4") sellerId?: string;
  @IsString() @MinLength(2) @MaxLength(120) recipientName!: string;
  @IsOptional() @IsString() @MaxLength(160) recipientContact?: string;
  @IsString() @Matches(/^(?:(?:[1-9]|[12]\d)(?:\.\d{1,2})?|30(?:\.0{1,2})?)$/) percentage!: string;
  @IsOptional() @IsIn(["seller", "platform"]) fundingSource?: "seller" | "platform";
  @IsOptional() @IsString() @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/) expiresAt?: string;
}

export class UpdateMarketingLinkDto {
  @IsOptional() @IsBoolean() active?: boolean;
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) recipientName?: string;
  @IsOptional() @IsString() @MaxLength(160) recipientContact?: string;
}

export class ListMarketingDto {
  @IsOptional() @IsUUID("4") sellerId?: string;
  @IsOptional() @IsUUID("4") cursor?: string;
}

export class MarketingOptionsDto {
  @IsOptional() @IsString() @MaxLength(80) search?: string;
}

export class MarketingVisitDto {
  @IsString() @Matches(/^[A-Za-z0-9_-]{16,32}$/) code!: string;
}

export class RecordMarketingPayoutDto {
  @IsString() @MinLength(3) @MaxLength(100) reference!: string;
}
