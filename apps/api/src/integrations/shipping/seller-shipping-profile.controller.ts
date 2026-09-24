import { Body, Controller, Get, HttpCode, Ip, Patch, Post, Req, UseGuards } from "@nestjs/common";
import type { SellerShippingProfile, ShippingPlaceOption } from "@topgsm/shared-types";
import { AuthenticatedGuard } from "../../modules/auth/authenticated.guard";
import { AuthRateLimitService } from "../../modules/auth/auth-rate-limit.service";
import type { AuthenticatedRequest } from "../../modules/auth/platform-admin.guard";
import { ListShippingPlacesDto, UpdateSellerShippingProfileDto } from "./dto/shipping-settings.dto";
import { SellerShippingProfileService } from "./seller-shipping-profile.service";
import { ShippingTenantService } from "./shipping-tenant.service";

@Controller("shipping/profile")
@UseGuards(AuthenticatedGuard)
export class SellerShippingProfileController {
  constructor(
    private readonly profiles: SellerShippingProfileService,
    private readonly tenants: ShippingTenantService,
    private readonly rateLimits: AuthRateLimitService
  ) {}

  @Get()
  get(@Req() request: AuthenticatedRequest): Promise<SellerShippingProfile> {
    return this.profiles.getMine(request.authenticatedUser!);
  }

  @Post("places")
  @HttpCode(200)
  async places(
    @Req() request: AuthenticatedRequest,
    @Ip() clientIp: string,
    @Body() body: ListShippingPlacesDto
  ): Promise<ShippingPlaceOption[]> {
    await this.rateLimits.consumeShippingConfiguration(request.authenticatedUser!.id, clientIp);
    const sellerId = await this.profiles.sellerIdForActor(request.authenticatedUser!);
    return this.tenants.listPlacesForSeller({ sellerId, ...body });
  }

  @Patch()
  async update(
    @Req() request: AuthenticatedRequest,
    @Ip() clientIp: string,
    @Body() body: UpdateSellerShippingProfileDto
  ): Promise<SellerShippingProfile> {
    await this.rateLimits.consumeShippingConfiguration(request.authenticatedUser!.id, clientIp);
    return this.profiles.updateMine(request.authenticatedUser!, body);
  }
}
