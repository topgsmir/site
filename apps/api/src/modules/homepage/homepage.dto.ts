import { Type } from "class-transformer";
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsInt, IsNotEmpty, IsObject, IsString, Matches, Max, MaxLength, Min, ValidateNested } from "class-validator";

export class HomepageLocaleDto {
  @IsIn(["fa", "en", "ar"])
  locale: "fa" | "en" | "ar" = "fa";
}

export class HomepageLinkDto {
  @IsString() @Matches(/\S/) @MaxLength(60)
  label!: string;
  @IsString() @IsNotEmpty() @MaxLength(2048)
  href!: string;
}

export class HomepageCardDto {
  @IsString() @Matches(/\S/) @MaxLength(120)
  title!: string;
  @IsString() @MaxLength(240)
  description!: string;
  @IsString() @MaxLength(40)
  label!: string;
  @IsString() @IsNotEmpty() @MaxLength(2048)
  href!: string;
  @IsString() @MaxLength(2048)
  image!: string;
}

export class HomepageSectionDto {
  @IsBoolean() enabled!: boolean;
  @IsString() @Matches(/\S/) @MaxLength(120) title!: string;
  @IsString() @MaxLength(500) description!: string;
}
export class HomepageCardsSectionDto extends HomepageSectionDto {
  @IsArray() @ArrayMaxSize(12) @ValidateNested({ each: true }) @Type(() => HomepageCardDto)
  items!: HomepageCardDto[];
}
export class HomepageAboutDto extends HomepageSectionDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(8) @IsString({ each: true }) @Matches(/\S/, { each: true }) @MaxLength(200, { each: true })
  points!: string[];
  @IsObject() @ValidateNested() @Type(() => HomepageLinkDto)
  link!: HomepageLinkDto;
}
export class HomepageHeroDto {
  @IsString() @MaxLength(100) eyebrow!: string;
  @IsString() @Matches(/\S/) @MaxLength(100) title!: string;
  @IsString() @MaxLength(100) accent!: string;
  @IsString() @MaxLength(500) description!: string;
  @IsString() @IsNotEmpty() @MaxLength(2048) image!: string;
  @IsString() @Matches(/\S/) @MaxLength(200) imageAlt!: string;
  @IsObject() @ValidateNested() @Type(() => HomepageLinkDto) primary!: HomepageLinkDto;
  @IsObject() @ValidateNested() @Type(() => HomepageLinkDto) secondary!: HomepageLinkDto;
}
export class HomepageFooterDto {
  @IsString() @MaxLength(500) description!: string;
  @IsArray() @ArrayMaxSize(10) @ValidateNested({ each: true }) @Type(() => HomepageLinkDto)
  links!: HomepageLinkDto[];
}
export class HomepageContentDto {
  @IsObject() @ValidateNested() @Type(() => HomepageHeroDto) hero!: HomepageHeroDto;
  @IsArray() @ArrayMaxSize(6) @ValidateNested({ each: true }) @Type(() => HomepageCardDto) shortcuts!: HomepageCardDto[];
  @IsObject() @ValidateNested() @Type(() => HomepageCardsSectionDto) collections!: HomepageCardsSectionDto;
  @IsObject() @ValidateNested() @Type(() => HomepageCardsSectionDto) offers!: HomepageCardsSectionDto;
  @IsObject() @ValidateNested() @Type(() => HomepageSectionDto) experts!: HomepageSectionDto;
  @IsObject() @ValidateNested() @Type(() => HomepageSectionDto) latest!: HomepageSectionDto;
  @IsObject() @ValidateNested() @Type(() => HomepageAboutDto) about!: HomepageAboutDto;
  @IsObject() @ValidateNested() @Type(() => HomepageFooterDto) footer!: HomepageFooterDto;
}
export class SaveHomepageDto {
  @IsInt() @Min(0) @Max(2_147_483_646) version!: number;
  @IsObject() @ValidateNested() @Type(() => HomepageContentDto) content!: HomepageContentDto;
}
