import { Transform } from "class-transformer";
import { IsBoolean, IsIn, IsInt, IsString, Matches, Max, MaxLength, Min } from "class-validator";

const locales = ["fa", "en", "ar"] as const;

function formInteger({ value }: { value: unknown }) {
  return typeof value === "string" && /^\d+$/.test(value) ? Number(value) : value;
}

function formBoolean({ value }: { value: unknown }) {
  if (value === "true") return true;
  if (value === "false") return false;
  return value;
}

export class HomepageStoriesQueryDto {
  @IsIn(locales)
  locale!: "fa" | "en" | "ar";
}

export class SaveHomepageStoryDto extends HomepageStoriesQueryDto {
  @IsString()
  @MaxLength(80)
  title!: string;

  @IsString()
  @MaxLength(2048)
  @Matches(/^(?:https?:\/\/|\/(?!\/))/i, { message: "targetUrl must be an HTTP(S) URL or a site-relative path" })
  targetUrl!: string;

  @Transform(formInteger)
  @IsInt()
  @Min(0)
  @Max(10000)
  position!: number;

  @Transform(formBoolean)
  @IsBoolean()
  enabled!: boolean;
}
