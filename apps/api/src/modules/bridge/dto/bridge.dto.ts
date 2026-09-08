import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength, ValidateNested } from "class-validator";

export const bridgeProviders = ["dhru_legacy", "dhru_new", "webx"] as const;

export class CreateBridgeConnectionDto {
  @IsString() @MinLength(1) @MaxLength(100) name!: string;
  @IsIn(bridgeProviders) provider!: (typeof bridgeProviders)[number];
  @IsString() @MinLength(8) @MaxLength(500) baseUrl!: string;
  @IsString() @MinLength(1) @MaxLength(255) username!: string;
  @IsString() @MinLength(8) @MaxLength(2000) apiKey!: string;
}

export class RotateBridgeConnectionDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(100) name?: string;
  @IsOptional() @IsString() @MinLength(8) @MaxLength(500) baseUrl?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(255) username?: string;
  @IsOptional() @IsString() @MinLength(8) @MaxLength(2000) apiKey?: string;
}

export class GrantBridgeServiceDto {
  @IsUUID("4") serviceId!: string;
}

export class RevokeBridgeGrantDto {
  @IsIn(["archive", "manual"]) productAction!: "archive" | "manual";
}

export class BridgeFieldLabelDto {
  @IsString() @MinLength(1) @MaxLength(100) key!: string;
  @IsString() @MinLength(1) @MaxLength(160) label!: string;
  @IsOptional() @IsString() @MaxLength(200) placeholder?: string;
  @IsOptional() @IsString() @MaxLength(500) helpText?: string;
}

export class BridgeProductBindingDto {
  @IsUUID("4") grantId!: string;
  @IsIn(["automatic", "manual"]) mode!: "automatic" | "manual";
  @Type(() => Number) @IsInt() @Min(1) @Max(100) minimumQuantity!: number;
  @Type(() => Number) @IsInt() @Min(1) @Max(100) maximumQuantity!: number;
  @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => BridgeFieldLabelDto)
  fieldLabels: BridgeFieldLabelDto[] = [];
}

export class CompleteBridgeOrderDto {
  @IsString()
  @MinLength(1)
  @MaxLength(10_000)
  result!: string;
}

export class RequestBridgeRefundDto {
  @IsString()
  @MinLength(3)
  @MaxLength(500)
  reason!: string;
}
