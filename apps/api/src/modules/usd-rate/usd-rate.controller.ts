import { Body, Controller, Get, Ip, Patch, Req, UseGuards } from "@nestjs/common";
import type { AdminUsdRateSettings } from "@topgsm/shared-types";
import { AuthRateLimitService } from "../auth/auth-rate-limit.service";
import type { AuthenticatedRequest } from "../auth/platform-admin.guard";
import { PlatformAdminGuard } from "../auth/platform-admin.guard";
import { UpdateUsdRateSettingsDto } from "./dto/usd-rate-settings.dto";
import { UsdRateService } from "./usd-rate.service";

@Controller("admin/settings/usd")
@UseGuards(PlatformAdminGuard)
export class UsdRateController {
  constructor(private readonly rates: UsdRateService, private readonly rateLimits: AuthRateLimitService) {}

  @Get()
  get(): Promise<AdminUsdRateSettings> {
    return this.rates.getAdminSettings();
  }

  @Patch()
  async update(
    @Req() request: AuthenticatedRequest,
    @Body() body: UpdateUsdRateSettingsDto,
    @Ip() clientIp: string
  ): Promise<AdminUsdRateSettings> {
    await this.rateLimits.consumeUsdConfiguration(request.authenticatedUser!.id, clientIp);
    return this.rates.update(body, request.authenticatedUser!.id);
  }
}
