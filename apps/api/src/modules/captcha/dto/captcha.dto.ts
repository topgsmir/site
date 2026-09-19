import { IsString, Matches } from "class-validator";

export class CreateCaptchaChallengeDto {
  @IsString()
  @Matches(/^[A-Za-z0-9_-]{1,32}$/)
  action!: string;
}
