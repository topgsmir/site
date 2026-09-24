import { Body, Controller, Get, HttpCode, Ip, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import type { AdminSellerShippingProfile, AdminSellerShippingProfilesPage, AdminShippingSettings, ShippingPlaceOption } from "@topgsm/shared-types";
import { AuthRateLimitService } from "../../modules/auth/auth-rate-limit.service";
import type { AuthenticatedRequest } from "../../modules/auth/platform-admin.guard";
import { PlatformAdminGuard } from "../../modules/auth/platform-admin.guard";
import { ListSellerShippingProfilesDto, ListShippingPlacesDto, UpdateSellerShippingProfileDto, UpdateShippingSettingsDto } from "./dto/shipping-settings.dto";
import { ShippingProviderRegistry } from "./shipping-provider.registry";
import { SellerShippingProfileService } from "./seller-shipping-profile.service";
import { ShippingTenantService } from "./shipping-tenant.service";

@Controller("admin/settings/shipping")
@UseGuards(PlatformAdminGuard)
export class ShippingSettingsController {
  constructor(
    private readonly providers: ShippingProviderRegistry,
    private readonly profiles: SellerShippingProfileService,
    private readonly tenants: ShippingTenantService,
    private readonly rateLimits: AuthRateLimitService
  ) {}

  @Get()
  get(): Promise<AdminShippingSettings> { return this.providers.active().getSettings(); }

  @Patch()
  async update(@Req() request: AuthenticatedRequest, @Ip() clientIp: string, @Body() body: UpdateShippingSettingsDto): Promise<AdminShippingSettings> {
    await this.rateLimits.consumeShippingConfiguration(request.authenticatedUser!.id, clientIp);
    return this.providers.active().configureApiKey(body.apiKey, request.authenticatedUser!.id);
  }

  @Post("profiles/:sellerId/places")
  @HttpCode(200)
  async places(
    @Req() request: AuthenticatedRequest,
    @Ip() clientIp: string,
    @Param("sellerId", new ParseUUIDPipe({ version: "4" })) sellerId: string,
    @Body() body: ListShippingPlacesDto
  ): Promise<ShippingPlaceOption[]> {
    await this.rateLimits.consumeShippingConfiguration(request.authenticatedUser!.id, clientIp);
    await this.profiles.assertAdminCanConfigure(sellerId);
    return this.tenants.listPlacesForSeller({ sellerId, ...body });
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
