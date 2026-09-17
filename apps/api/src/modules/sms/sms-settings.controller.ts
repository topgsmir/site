import { Body, Controller, Get, Ip, Patch, Req, UseGuards } from "@nestjs/common";
import type { AdminSmsSettings } from "@topgsm/shared-types";
import { AuthRateLimitService } from "../auth/auth-rate-limit.service";
import type { AuthenticatedRequest } from "../auth/platform-admin.guard";
import { PlatformAdminGuard } from "../auth/platform-admin.guard";
import { UpdateSmsSettingsDto } from "./dto/sms-settings.dto";
import { SmsSettingsService } from "./sms-settings.service";

@Controller("admin/settings/sms")
@UseGuards(PlatformAdminGuard)
export class SmsSettingsController {
  constructor(
    private readonly settings: SmsSettingsService,
    private readonly rateLimits: AuthRateLimitService
  ) {}

  @Get()
  get(): Promise<AdminSmsSettings> {
    return this.settings.get();
  }

  @Patch()
  async update(
    @Req() request: AuthenticatedRequest,
    @Ip() clientIp: string,
    @Body() body: UpdateSmsSettingsDto
  ): Promise<AdminSmsSettings> {
    await this.rateLimits.consumeSmsConfiguration(request.authenticatedUser!.id, clientIp);
    return this.settings.update(body, request.authenticatedUser!.id);
  }
}
