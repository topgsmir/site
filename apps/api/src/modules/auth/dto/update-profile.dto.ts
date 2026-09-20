import { IsEmail, IsString, Matches, MaxLength, MinLength, ValidateIf } from "class-validator";

export class UpdateProfileDto {
  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  fullName?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @ValidateIf((_, value) => value !== undefined)
  @IsString()
  @Matches(/^[a-z0-9_]{3,32}$/)
  username?: string;
}
