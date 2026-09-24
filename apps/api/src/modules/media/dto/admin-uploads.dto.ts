import { Type } from "class-transformer";
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsDateString,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested
} from "class-validator";

export class AdminUploadsQueryDto {
  @IsOptional() @IsString() @MaxLength(1000) cursor?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(50) limit = 25;
  @IsOptional() @IsIn(["all", "blog", "product"]) source: "all" | "blog" | "product" = "all";
  @IsOptional() @IsIn(["all", "active", "trashed"]) state: "all" | "active" | "trashed" = "all";
  @IsOptional() @IsIn(["all", "linked", "unlinked"]) linked: "all" | "linked" | "unlinked" = "all";
  @IsOptional() @IsDateString() from?: string;
  @IsOptional() @IsDateString() to?: string;
  @IsOptional() @IsString() @MaxLength(100) search?: string;
  @IsOptional() @IsIn(["newest", "oldest", "size"]) sort: "newest" | "oldest" | "size" = "newest";
}

export class AdminUploadRefDto {
  @IsIn(["blog", "product"]) source!: "blog" | "product";
  @IsUUID("4") id!: string;
}

export class TrashAdminUploadsDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(50)
  @ValidateNested({ each: true }) @Type(() => AdminUploadRefDto)
  items!: AdminUploadRefDto[];

  @IsString() @MinLength(3) @MaxLength(500)
  reason!: string;
}

export class RestoreAdminUploadsDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(50)
  @ValidateNested({ each: true }) @Type(() => AdminUploadRefDto)
  items!: AdminUploadRefDto[];
}
