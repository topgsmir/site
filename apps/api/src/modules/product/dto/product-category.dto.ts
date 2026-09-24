import { Type } from "class-transformer";
import { ArrayMaxSize, ArrayUnique, IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength, ValidateNested } from "class-validator";

export class ProductCategoriesQueryDto {
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @IsUUID("4") cursor?: string;
  @Type(() => Number) @IsInt() @Min(1) @Max(50) limit = 20;
}

class CategoryTranslationDto {
  @IsIn(["en", "ar"]) locale!: "en" | "ar";
  @IsString() @MinLength(1) @MaxLength(100) name!: string;
}

export class UpdateProductCategoryDto {
  @IsOptional() @IsString() @MinLength(1) @MaxLength(100) name?: string;
  @IsOptional() @IsArray() @ArrayMaxSize(2)
  @ArrayUnique((translation: CategoryTranslationDto | null) => translation?.locale)
  @ValidateNested({ each: true }) @Type(() => CategoryTranslationDto)
  translations?: CategoryTranslationDto[];
}
