import { Type } from "class-transformer";
import { ArrayMaxSize, IsArray, IsBoolean, IsIn, IsInt, IsObject, IsString, Matches, Max, MaxLength, Min, ValidateNested } from "class-validator";
import { templateIcons } from "@topgsm/shared-types";
import type { TemplateIcon } from "@topgsm/shared-types";
export class TemplateLocaleDto { @IsIn(["fa", "en", "ar"]) locale: "fa" | "en" | "ar" = "fa"; }
export class TemplateMenuItemDto {
  @IsString() @Matches(/\S/) @MaxLength(60) label!: string;
  @IsString() @Matches(/\S/) @MaxLength(500) href!: string;
  @IsIn(templateIcons) icon!: TemplateIcon;
  @IsBoolean() enabled!: boolean;
}
export class TemplateBannerDto {
  @IsBoolean() enabled!: boolean;
  @IsString() @MaxLength(200) text!: string;
  @IsString() @MaxLength(60) linkLabel!: string;
  @IsString() @Matches(/\S/) @MaxLength(500) href!: string;
  @IsString() @MaxLength(500) image!: string;
  @IsString() @MaxLength(200) imageAlt!: string;
}
export class TemplateCategoriesDto {
  @IsBoolean() enabled!: boolean;
  @IsString() @Matches(/\S/) @MaxLength(60) title!: string;
  @IsArray() @ArrayMaxSize(12) @ValidateNested({ each: true }) @Type(() => TemplateMenuItemDto) items!: TemplateMenuItemDto[];
}
export class TemplateConfigurationDto {
  @IsString() @MaxLength(100) tagline!: string;
  @IsObject() @ValidateNested() @Type(() => TemplateBannerDto) banner!: TemplateBannerDto;
  @IsArray() @ArrayMaxSize(8) @ValidateNested({ each: true }) @Type(() => TemplateMenuItemDto) navigation!: TemplateMenuItemDto[];
  @IsObject() @ValidateNested() @Type(() => TemplateCategoriesDto) categories!: TemplateCategoriesDto;
}
export class SaveTemplateSettingsDto {
  @IsInt() @Min(0) @Max(2_147_483_646) version!: number;
  @IsObject() @ValidateNested() @Type(() => TemplateConfigurationDto) configuration!: TemplateConfigurationDto;
}
