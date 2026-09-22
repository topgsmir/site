import { IsIn, IsOptional, IsString, IsUUID, MaxLength } from "class-validator";

export class ProductLocaleQueryDto {
  @IsOptional()
  @IsIn(["fa", "en", "ar"])
  locale: "fa" | "en" | "ar" = "fa";
}

export class ProductTranslationParamsDto {
  @IsUUID("4")
  productId!: string;

  @IsIn(["en", "ar"])
  locale!: "en" | "ar";
}

export class ProductTranslationDraftDto {
  @IsString()
  @MaxLength(200)
  title!: string;

  @IsString()
  @MaxLength(10000)
  description!: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  category?: string | null;
}
