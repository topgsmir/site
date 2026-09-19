import { Body, Controller, Get, Ip, Param, ParseUUIDPipe, Patch, Query, Req, UseGuards } from "@nestjs/common";
import type { AdminSellerShippingProfile, AdminSellerShippingProfilesPage, AdminShippingSettings } from "@topgsm/shared-types";
import { AuthRateLimitService } from "../../modules/auth/auth-rate-limit.service";
import type { AuthenticatedRequest } from "../../modules/auth/platform-admin.guard";
import { PlatformAdminGuard } from "../../modules/auth/platform-admin.guard";
import { AmadastSettingsService } from "./amadast/amadast-settings.service";
import { ListSellerShippingProfilesDto, UpdateSellerShippingProfileDto, UpdateShippingSettingsDto } from "./dto/shipping-settings.dto";
import { SellerShippingProfileService } from "./seller-shipping-profile.service";

@Controller("admin/settings/shipping")
@UseGuards(PlatformAdminGuard)
export class ShippingSettingsController {
  constructor(
    private readonly settings: AmadastSettingsService,
    private readonly profiles: SellerShippingProfileService,
    private readonly rateLimits: AuthRateLimitService
  ) {}

  @Get()
  get(): Promise<AdminShippingSettings> { return this.settings.get(); }

  @Patch()
  async update(@Req() request: AuthenticatedRequest, @Ip() clientIp: string, @Body() body: UpdateShippingSettingsDto): Promise<AdminShippingSettings> {
    await this.rateLimits.consumeShippingConfiguration(request.authenticatedUser!.id, clientIp);
    return this.settings.update(body, request.authenticatedUser!.id);
  }

  @Get("profiles")
  listProfiles(@Query() query: ListSellerShippingProfilesDto): Promise<AdminSellerShippingProfilesPage> {
    return this.profiles.listAdmin(query);
  }

  @Patch("profiles/:sellerId")
  async updateProfile(
    @Req() request: AuthenticatedRequest,
    @Ip() clientIp: string,
    @Param("sellerId", new ParseUUIDPipe({ version: "4" })) sellerId: string,
    @Body() body: UpdateSellerShippingProfileDto
  ): Promise<AdminSellerShippingProfile> {
    await this.rateLimits.consumeShippingConfiguration(request.authenticatedUser!.id, clientIp);
    return this.profiles.updateAdmin(sellerId, request.authenticatedUser!.id, body);
  }
}
