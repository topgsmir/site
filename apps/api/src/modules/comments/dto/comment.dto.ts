import { Type } from "class-transformer";
import { IsBoolean, IsIn, IsInt, IsOptional, IsString, IsUUID, Matches, Max, MaxLength, Min, MinLength } from "class-validator";

export class CreateCommentDto {
  @IsString() @MinLength(1) @MaxLength(2000)
  body!: string;

  @IsOptional() @IsString() @MinLength(1) @MaxLength(100)
  guestName?: string;

  @IsOptional() @IsString() @Matches(/^[0-9a-f-]{36}\.[0-9]{1,10}$/i)
  captchaToken?: string;
}

export class ReplyCommentDto {
  @IsString() @MinLength(1) @MaxLength(2000)
  body!: string;
}

export class UpdateCommentSettingsDto {
  @IsIn(["purchasers", "buyers", "guests"])
  postingPolicy!: "purchasers" | "buyers" | "guests";

  @IsIn(["approval", "immediate"])
  publicationPolicy!: "approval" | "immediate";

  @IsBoolean()
  sellerLockEnabled!: boolean;
}

export class ListCommentsDto {
  @IsOptional() @IsUUID("4")
  cursor?: string;

  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50)
  limit = 20;
}

export class AdminListCommentsDto extends ListCommentsDto {
  @IsOptional() @IsString() @MaxLength(100)
  search?: string;

  @IsOptional() @IsIn(["pending", "approved", "rejected", "spam_review", "spam"])
  status?: "pending" | "approved" | "rejected" | "spam_review" | "spam";

  @IsOptional() @IsIn(["product", "blog"])
  target?: "product" | "blog";

  @IsOptional() @IsIn(["fa", "en", "ar"])
  locale: "fa" | "en" | "ar" = "fa";
}

export class SellerListCommentsDto extends ListCommentsDto {
  @IsOptional() @IsIn(["fa", "en", "ar"])
  locale: "fa" | "en" | "ar" = "fa";
}
