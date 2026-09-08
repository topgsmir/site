import { Type } from "class-transformer";
import { IsIn, IsNumber, IsOptional, Max, Min } from "class-validator";

export class UploadBlogMediaDto {
  @IsIn(["cover", "inline"])
  kind!: "cover" | "inline";

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  focalX = 0.5;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(1)
  focalY = 0.5;
}
