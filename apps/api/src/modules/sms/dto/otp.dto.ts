import { IsEmail, IsOptional, IsString, IsUUID, Matches, MaxLength, MinLength } from "class-validator";
import { Transform } from "class-transformer";

export class RequestOtpDto {
  @IsString()
  @Matches(/^(?:\+98|0098|98|0)?9\d{9}$/)
  phoneNumber!: string;

  @IsOptional() @IsString() @Matches(/^[0-9a-f-]{36}\.[0-9]{1,10}$/i) captchaToken?: string;
}

export class VerifyOtpDto extends RequestOtpDto {
  @IsUUID("4") challengeId!: string;
  @IsString() @Matches(/^\d{6}$/) code!: string;
  @Transform(({ value }: { value: unknown }) => typeof value === "string" && !value.trim() ? undefined : value)
  @IsOptional() @IsString() @MinLength(2) @MaxLength(120) fullName?: string;
  @Transform(({ value }: { value: unknown }) => typeof value === "string" && !value.trim() ? undefined : value)
  @IsOptional() @IsEmail() @MaxLength(254) email?: string;
}
