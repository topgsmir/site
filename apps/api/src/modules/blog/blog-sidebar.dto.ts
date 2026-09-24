import { ArrayMaxSize, ArrayUnique, IsArray, IsBoolean, IsIn, IsInt, IsObject, IsString, IsUUID, Matches, Max, MaxLength, Min, ValidateNested } from "class-validator";
import { Type } from "class-transformer";

export class BlogSidebarLocaleDto {
  @IsIn(["fa", "en", "ar"])
  locale: "fa" | "en" | "ar" = "fa";
}

export class BlogSidebarContentDto {
  @IsBoolean()
  enabled!: boolean;

  @IsString()
  @Matches(/\S/u)
  @MaxLength(120)
  title!: string;

  @IsString()
  @MaxLength(500)
  description!: string;

  @IsString()
  @Matches(/\S/u)
  @MaxLength(60)
  ctaLabel!: string;

  @IsString()
  @Matches(/\S/u)
  @MaxLength(2048)
  ctaHref!: string;
}

export class SaveBlogSidebarDto {
  @IsInt()
  @Min(0)
  @Max(2_147_483_646)
  version!: number;

  @IsObject()
  @ValidateNested()
  @Type(() => BlogSidebarContentDto)
  content!: BlogSidebarContentDto;

  @IsArray()
  @ArrayMaxSize(3)
  @ArrayUnique()
  @IsUUID("4", { each: true })
  productIds!: string[];
}
