import { IsBoolean, IsInt, IsOptional, IsString, Max, MaxLength, Min, MinLength } from "class-validator";

export class UpdateSmsSettingsDto {
  @IsBoolean()
  otpEnabled!: boolean;

  @IsOptional()
  @IsString()
  @MinLength(8)
  @MaxLength(2000)
  apiKey?: string;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  otpTemplateId?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  sellerNewOrderTemplateId?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  buyerSuccessTemplateId?: number | null;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2_147_483_647)
  buyerFailureTemplateId?: number | null;
}
