import { Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsDefined, IsIn, IsInt, IsString, Matches, Max, MaxLength, Min, MinLength, ValidateNested } from "class-validator";
import type { SeoLocale } from "@topgsm/shared-types";

export class SeoLocaleDefaultsDto {
  @IsIn(["fa", "en", "ar"]) locale!: SeoLocale;
  @IsString() @MinLength(1) @MaxLength(80) siteName!: string;
  @IsString() @MaxLength(120) @Matches(/^[^%]*%s[^%]*$/) titleTemplate!: string;
  @IsString() @MaxLength(320) description!: string;
  @IsString() @MaxLength(1000) socialImage!: string;
}
export class SeoPageOverrideDto {
  @IsString() @MaxLength(500) path!: string;
  @IsString() @MaxLength(120) title!: string;
  @IsString() @MaxLength(320) description!: string;
  @IsString() @MaxLength(1000) socialImage!: string;
  @IsBoolean() noIndex!: boolean;
  @IsBoolean() excludeFromSitemap!: boolean;
}
export class SeoRedirectDto {
  @IsString() @MaxLength(500) source!: string;
  @IsString() @MaxLength(500) destination!: string;
  @IsIn([301, 302]) status!: 301 | 302;
  @IsBoolean() enabled!: boolean;
}
export class SeoConfigurationDto {
  @IsBoolean() indexingEnabled!: boolean;
  @IsArray() @ArrayMinSize(3) @ArrayMaxSize(3) @ValidateNested({ each: true }) @Type(() => SeoLocaleDefaultsDto) locales!: SeoLocaleDefaultsDto[];
  @IsString() @MaxLength(200) @Matches(/^[\w-]*$/) googleVerification!: string;
  @IsString() @MaxLength(200) @Matches(/^[\w-]*$/) bingVerification!: string;
  @IsString() @MinLength(1) @MaxLength(120) organizationName!: string;
  @IsString() @MaxLength(1000) organizationLogo!: string;
  @IsArray() @ArrayMaxSize(10) @IsString({ each: true }) @MaxLength(1000, { each: true }) sameAs!: string[];
  @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => SeoPageOverrideDto) pages!: SeoPageOverrideDto[];
  @IsArray() @ArrayMaxSize(100) @ValidateNested({ each: true }) @Type(() => SeoRedirectDto) redirects!: SeoRedirectDto[];
}
export class UpdateSeoSettingsDto {
  @IsInt() @Min(0) @Max(2147483646) version!: number;
  @IsDefined() @ValidateNested() @Type(() => SeoConfigurationDto) configuration!: SeoConfigurationDto;
}
