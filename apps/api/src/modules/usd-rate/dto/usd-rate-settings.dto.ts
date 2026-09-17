import type { UsdRateProviderId } from "@topgsm/shared-types";
import { IsBoolean, IsIn, IsOptional, IsString, Matches, ValidateIf } from "class-validator";
import { USD_RATE_PROVIDER_IDS } from "../usd-rate-provider.registry";

export class UpdateUsdRateSettingsDto {
  @IsOptional()
  @IsBoolean()
  automationEnabled?: boolean;

  @IsOptional()
  @IsString()
  @Matches(/^\d{1,8}(?:\.\d{1,2})?$/)
  manualRateToman?: string;

  @IsOptional()
  @IsIn(USD_RATE_PROVIDER_IDS)
  provider?: UsdRateProviderId;

  @ValidateIf((input: UpdateUsdRateSettingsDto) =>
    input.automationEnabled === undefined && input.manualRateToman === undefined && input.provider === undefined
  )
  @Matches(/a^/, { message: "At least one USD setting must be provided" })
  private readonly requiredSetting?: string;
}
