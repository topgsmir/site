import { IsIn, IsOptional, IsUUID } from "class-validator";

export class SitemapFeedDto {
  @IsIn(["products", "posts", "categories", "tags", "sellers"])
  kind!: "products" | "posts" | "categories" | "tags" | "sellers";

  @IsIn(["fa", "en", "ar"])
  locale!: "fa" | "en" | "ar";

  @IsOptional()
  @IsUUID("4")
  cursor?: string;
}
