import { Type } from "class-transformer";
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength, ValidateIf } from "class-validator";

export class ProductDescriptionTemplatesQueryDto {
  @IsIn(["fa", "en", "ar"])
  locale!: "fa" | "en" | "ar";

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

export class CreateProductDescriptionTemplateDto {
  @IsIn(["fa", "en", "ar"])
  locale!: "fa" | "en" | "ar";

  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(10_000)
  content!: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  active?: boolean;
}

export class UpdateProductDescriptionTemplateDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MinLength(1)
  @MaxLength(10_000)
  content?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsBoolean()
  active?: boolean;
}
