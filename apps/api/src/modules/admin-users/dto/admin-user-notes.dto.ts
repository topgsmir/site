import { Type } from "class-transformer";
import { IsBoolean, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min, MinLength } from "class-validator";

export class UserNotesQueryDto {
  @IsOptional() @IsUUID("4") cursor?: string;
  @IsOptional() @Type(() => Number) @IsInt() @Min(1) @Max(30) limit = 10;
}

export class CreateUserNoteDto {
  @IsString() @MinLength(3) @MaxLength(1000) body!: string;
  @IsOptional() @IsBoolean() sellerVisible = false;
}
