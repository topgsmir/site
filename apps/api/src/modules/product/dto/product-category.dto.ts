import { Type } from "class-transformer";
import { ArrayMaxSize, ArrayUnique, IsArray, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength, Matches, ValidateIf, ValidateNested } from "class-validator";

const CATEGORY_SLUG = /^[\p{L}\p{N}]+(?:-[\p{L}\p{N}]+)*$/u;

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
  @IsOptional() @IsString() @MinLength(1) @MaxLength(160) @Matches(CATEGORY_SLUG) slug?: string;
  @ValidateIf((_, value) => value !== undefined && value !== null) @IsString() @MaxLength(4000) description?: string | null;
  @ValidateIf((_, value) => value !== undefined && value !== null) @IsString() @MaxLength(160) metaTitle?: string | null;
  @ValidateIf((_, value) => value !== undefined && value !== null) @IsString() @MaxLength(320) metaDescription?: string | null;
  @ValidateIf((_, value) => value !== undefined && value !== null) @IsUUID("4") parentId?: string | null;
  @IsOptional() @IsArray() @ArrayMaxSize(2)
  @ArrayUnique((translation: CategoryTranslationDto | null) => translation?.locale)
  @ValidateNested({ each: true }) @Type(() => CategoryTranslationDto)
  translations?: CategoryTranslationDto[];
}

export class CreateProductCategoryDto extends UpdateProductCategoryDto {
  // Create validates the required name in the service after trimming; the base
  // DTO keeps PATCH fields optional for partial updates.
}

export class DeleteProductCategoryDto {
  @IsIn(["uncategorize", "move"]) productAction!: "uncategorize" | "move";
  @ValidateIf((body: DeleteProductCategoryDto) => body.productAction === "move")
  @IsUUID("4") replacementCategoryId?: string;
}
