import { ArrayMaxSize, ArrayMinSize, ArrayUnique, IsArray, IsIn, IsInt, IsOptional, IsString, IsUrl, Matches, Max, MaxLength, Min } from "class-validator";
import { Type } from "class-transformer";

export class DownloadLinkDto {
  @IsUrl({ protocols: ["https"], require_protocol: true })
  @MaxLength(2048)
  url!: string;

  @IsString()
  @Matches(/\S/u)
  @MaxLength(120)
  title!: string;
}

export class ReplaceDownloadLinksDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsUrl({ protocols: ["https"], require_protocol: true }, { each: true })
  @MaxLength(2048, { each: true })
  fileReferences!: string[];

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @Matches(/\S/u, { each: true })
  @MaxLength(120, { each: true })
  fileTitles!: string[];
}

export class RequestDownloadLinkChangeDto {
  @IsIn(["edit", "delete"])
  action!: "edit" | "delete";

  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(49)
  linkIndex!: number;

  @IsOptional()
  @IsUrl({ protocols: ["https"], require_protocol: true })
  @MaxLength(2048)
  url?: string;

  @IsOptional()
  @IsString()
  @Matches(/\S/u)
  @MaxLength(120)
  title?: string;
}

export class ReviewDownloadLinkChangeDto {
  @IsIn(["approved", "rejected"])
  status!: "approved" | "rejected";

  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
