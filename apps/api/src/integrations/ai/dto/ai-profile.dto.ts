import { IsIn, IsOptional, IsString, IsUUID, IsUrl, Matches, MaxLength, MinLength } from "class-validator";

const usdPerMillionPattern = /^(?:0|[1-9]\d{0,5})(?:\.\d{1,8})?$/;

export class CreateAiProfileDto {
  @IsString() @MinLength(1) @MaxLength(100) name!: string;
  @IsIn(["openai", "anthropic"]) provider!: "openai" | "anthropic";
  @IsString() @MinLength(1) @MaxLength(200) modelId!: string;
  @IsOptional() @IsUrl({ protocols: ["https"], require_protocol: true, require_tld: true }) @MaxLength(500) baseUrl?: string;
  @IsString() @MinLength(8) @MaxLength(2000) apiKey!: string;
  @IsOptional() @IsString() @Matches(usdPerMillionPattern) inputPricePerMillionUsd?: string | null;
  @IsOptional() @IsString() @Matches(usdPerMillionPattern) outputPricePerMillionUsd?: string | null;
}

export class UpdateAiProfileDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(100) name?: string;
  @IsOptional() @IsString() @MinLength(1) @MaxLength(200) modelId?: string;
  @IsOptional() @IsUrl({ protocols: ["https"], require_protocol: true, require_tld: true }) @MaxLength(500) baseUrl?: string;
  @IsOptional() @IsString() @MinLength(8) @MaxLength(2000) apiKey?: string;
  @IsOptional() @IsString() @Matches(usdPerMillionPattern) inputPricePerMillionUsd?: string | null;
  @IsOptional() @IsString() @Matches(usdPerMillionPattern) outputPricePerMillionUsd?: string | null;
}

export class BindAiCapabilityDto {
  @IsUUID("4") profileId!: string;
}
