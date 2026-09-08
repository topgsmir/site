import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested
} from "class-validator";

const SLUG_PATTERN = /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u;
export const BLOG_LOCALES = ["fa", "en", "ar"] as const;

export class ListBlogPostsQueryDto {
  @IsOptional()
  @IsUUID("4")
  cursor?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit = 20;
}

export class PublicBlogQueryDto extends ListBlogPostsQueryDto {
  @IsIn(BLOG_LOCALES)
  locale!: (typeof BLOG_LOCALES)[number];
}

export class BlogTranslationDto {
  @IsIn(BLOG_LOCALES)
  locale!: (typeof BLOG_LOCALES)[number];

  @IsString()
  @MaxLength(200)
  title = "";

  @IsString()
  @MaxLength(200)
  @Matches(/^$|^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u)
  slug = "";

  @IsString()
  @MaxLength(500)
  excerpt = "";

  @IsString()
  @MaxLength(70)
  seoTitle = "";

  @IsString()
  @MaxLength(170)
  seoDescription = "";

  @IsString()
  @MaxLength(300)
  coverAltText = "";

  @IsObject()
  content!: Record<string, unknown>;
}

export class CreateBlogPostDto {
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => BlogTranslationDto)
  translations?: BlogTranslationDto[];
}

export class UpdateBlogPostDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  optimisticVersion!: number;

  @IsArray()
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => BlogTranslationDto)
  translations!: BlogTranslationDto[];

  @IsOptional()
  @IsUUID("4")
  coverAssetId?: string;

  @IsOptional()
  @IsUUID("4")
  categoryId?: string;

  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(20)
  @IsUUID("4", { each: true })
  tagIds!: string[];

  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(8)
  @IsUUID("4", { each: true })
  relatedProductIds!: string[];
}

export class RejectBlogPostDto {
  @IsString()
  @MinLength(2)
  @MaxLength(2000)
  note!: string;
}

export class TaxonomyTranslationDto {
  @IsIn(BLOG_LOCALES)
  locale!: (typeof BLOG_LOCALES)[number];

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(120)
  @Matches(SLUG_PATTERN)
  slug!: string;
}

export class TaxonomyDto {
  @IsArray()
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => TaxonomyTranslationDto)
  translations!: TaxonomyTranslationDto[];
}

export class ProductOptionsQueryDto extends ListBlogPostsQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
