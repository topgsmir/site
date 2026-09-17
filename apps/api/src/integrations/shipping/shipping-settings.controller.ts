import { Body, Controller, Get, Ip, Patch, Req, UseGuards } from "@nestjs/common";
import type { AdminShippingSettings } from "@topgsm/shared-types";
import { AuthRateLimitService } from "../../modules/auth/auth-rate-limit.service";
import type { AuthenticatedRequest } from "../../modules/auth/platform-admin.guard";
import { PlatformAdminGuard } from "../../modules/auth/platform-admin.guard";
import { AmadastSettingsService } from "./amadast/amadast-settings.service";
import { UpdateShippingSettingsDto } from "./dto/shipping-settings.dto";

@Controller("admin/settings/shipping")
@UseGuards(PlatformAdminGuard)
export class ShippingSettingsController {
  constructor(private readonly settings: AmadastSettingsService, private readonly rateLimits: AuthRateLimitService) {}

  @Get()
  get(): Promise<AdminShippingSettings> { return this.settings.get(); }

  @Patch()
  async update(@Req() request: AuthenticatedRequest, @Ip() clientIp: string, @Body() body: UpdateShippingSettingsDto): Promise<AdminShippingSettings> {
    await this.rateLimits.consumeShippingConfiguration(request.authenticatedUser!.id, clientIp);
    return this.settings.update(body, request.authenticatedUser!.id);
  }
}
