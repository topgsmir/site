import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, MaxLength, MinLength } from "class-validator";

export class ContentAiKindDto {
  @IsIn(["blog", "product"])
  kind!: "blog" | "product";
}

export class ContentAiDraftDto {
  @IsIn(["fa", "en", "ar"])
  locale!: "fa" | "en" | "ar";

  @IsString()
  @MinLength(20)
  @MaxLength(16000)
  source!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  keyword?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  audience?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  coverDescription?: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  categories?: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  tags?: string[];
}
