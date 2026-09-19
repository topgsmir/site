import { IsOptional, IsString, Matches, MaxLength, MinLength } from "class-validator";

export class LoginDto {
  @IsString()
  @MinLength(1)
  @MaxLength(254)
  identifier!: string;

  @IsString()
  @MinLength(1)
  @MaxLength(128)
  password!: string;

  @IsOptional() @IsString() @Matches(/^[0-9a-f-]{36}\.[0-9]{1,10}$/i) captchaToken?: string;
}
