import { Body, Controller, Get, Header, Ip, Patch, Req, UseGuards } from "@nestjs/common";
import { PlatformAdminGuard, type AuthenticatedRequest } from "../auth/platform-admin.guard";
import { AuthRateLimitService } from "../auth/auth-rate-limit.service";
import { SeoSettingsService } from "./seo-settings.service";
import { UpdateSeoSettingsDto } from "./seo-settings.dto";

@Controller("seo/configuration")
export class PublicSeoSettingsController {
  constructor(private readonly seo: SeoSettingsService) {}
  @Get()
  @Header("Cache-Control", "public, max-age=60")
  get() { return this.seo.publicConfiguration(); }
}

@Controller("admin/seo")
@UseGuards(PlatformAdminGuard)
export class AdminSeoSettingsController {
  constructor(private readonly seo: SeoSettingsService, private readonly limits: AuthRateLimitService) {}
  @Get()
  @Header("Cache-Control", "no-store")
  get() { return this.seo.get(); }
  @Get("history")
  @Header("Cache-Control", "no-store")
  history() { return this.seo.history(); }
  @Patch()
  async update(@Req() request: AuthenticatedRequest, @Ip() ip: string, @Body() body: UpdateSeoSettingsDto) {
    await this.limits.consumeSeoConfiguration(request.authenticatedUser!.id, ip);
    return this.seo.update(body, request.authenticatedUser!.id);
  }
}
