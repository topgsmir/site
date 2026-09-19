import { Body, Controller, Get, Ip, Patch, Req, UseGuards } from "@nestjs/common";
import type { SellerShippingProfile } from "@topgsm/shared-types";
import { AuthenticatedGuard } from "../../modules/auth/authenticated.guard";
import { AuthRateLimitService } from "../../modules/auth/auth-rate-limit.service";
import type { AuthenticatedRequest } from "../../modules/auth/platform-admin.guard";
import { UpdateSellerShippingProfileDto } from "./dto/shipping-settings.dto";
import { SellerShippingProfileService } from "./seller-shipping-profile.service";

@Controller("shipping/profile")
@UseGuards(AuthenticatedGuard)
export class SellerShippingProfileController {
  constructor(
    private readonly profiles: SellerShippingProfileService,
    private readonly rateLimits: AuthRateLimitService
  ) {}

  @Get()
  get(@Req() request: AuthenticatedRequest): Promise<SellerShippingProfile> {
    return this.profiles.getMine(request.authenticatedUser!);
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
