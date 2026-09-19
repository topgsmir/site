import { Body, Controller, Get, Ip, Patch, Req, UseGuards } from "@nestjs/common";
import type { AdminAuthLoginSettings, AuthLoginMethods } from "@topgsm/shared-types";
import { AuthRateLimitService } from "./auth-rate-limit.service";
import { AuthLoginSettingsService } from "./auth-login-settings.service";
import { UpdateAuthLoginSettingsDto } from "./dto/auth-login-settings.dto";
import { PlatformAdminGuard, type AuthenticatedRequest } from "./platform-admin.guard";

@Controller("auth/login-methods")
export class AuthLoginMethodsController {
  constructor(private readonly settings: AuthLoginSettingsService) {}

  @Get()
  get(): Promise<AuthLoginMethods> { return this.settings.getPublic(); }
}

@Controller("admin/settings/auth")
@UseGuards(PlatformAdminGuard)
export class AdminAuthLoginSettingsController {
  constructor(private readonly settings: AuthLoginSettingsService, private readonly rateLimits: AuthRateLimitService) {}

  @Get()
  get(): Promise<AdminAuthLoginSettings> { return this.settings.getAdmin(); }

  @Patch()
  async update(@Req() request: AuthenticatedRequest, @Ip() clientIp: string, @Body() body: UpdateAuthLoginSettingsDto): Promise<AdminAuthLoginSettings> {
    await this.rateLimits.consumeAuthConfiguration(request.authenticatedUser!.id, clientIp);
    return this.settings.update(body, request.authenticatedUser!.id);
  }
}
