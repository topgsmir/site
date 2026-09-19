import { IsBoolean, IsInt, Max, Min } from "class-validator";

export class UpdateSecurityPolicyDto {
  @IsInt() @Min(1) @Max(1000) ipLimit!: number;
  @IsInt() @Min(1) @Max(1000) subjectLimit!: number;
  @IsInt() @Min(60) @Max(86400) ipWindowSeconds!: number;
  @IsInt() @Min(60) @Max(86400) subjectWindowSeconds!: number;
  @IsBoolean() captchaEnabled!: boolean;
}
