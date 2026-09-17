import { Body, Controller, Get, Patch, Req, UseGuards } from "@nestjs/common";
import type { AdminUsdRateSettings } from "@topgsm/shared-types";
import type { AuthenticatedRequest } from "../auth/platform-admin.guard";
import { PlatformAdminGuard } from "../auth/platform-admin.guard";
import { UpdateUsdRateSettingsDto } from "./dto/usd-rate-settings.dto";
import { UsdRateService } from "./usd-rate.service";

@Controller("admin/settings/usd")
@UseGuards(PlatformAdminGuard)
export class UsdRateController {
  constructor(private readonly rates: UsdRateService) {}

  @Get()
  get(): Promise<AdminUsdRateSettings> {
    return this.rates.getAdminSettings();
  }

  @Patch()
  update(
    @Req() request: AuthenticatedRequest,
    @Body() body: UpdateUsdRateSettingsDto
  ): Promise<AdminUsdRateSettings> {
    return this.rates.update(body, request.authenticatedUser!.id);
  }
}
