import { Body, Controller, Get, Header, Ip, Patch, Post, Req, UseGuards } from "@nestjs/common";
import type { AdminGoghdiSettings, GoghdiPublicConfig } from "@topgsm/shared-types";
import { AuthenticatedGuard } from "../auth/authenticated.guard";
import { AuthRateLimitService } from "../auth/auth-rate-limit.service";
import { PlatformAdminGuard, type AuthenticatedRequest } from "../auth/platform-admin.guard";
import { UpdateGoghdiSettingsDto } from "./dto/goghdi-settings.dto";
import { GoghdiOrderTicketDto } from "./dto/order-ticket.dto";
import { GoghdiSettingsService } from "./goghdi-settings.service";
import { GoghdiService } from "./goghdi.service";

@Controller("goghdi")
export class GoghdiController {
  constructor(
    private readonly goghdi: GoghdiService,
    private readonly rateLimits: AuthRateLimitService
  ) {}

  @Post("order-ticket")
  @UseGuards(AuthenticatedGuard)
  @Header("Cache-Control", "no-store")
  async signOrderTicket(
    @Body() body: GoghdiOrderTicketDto,
    @Req() request: AuthenticatedRequest,
    @Ip() clientIp: string
  ) {
    await this.rateLimits.consumeSignedTicket(request.authenticatedUser!.id, clientIp);
    return this.goghdi.signOrderTicket(body.orderId, request.authenticatedUser!.id);
  }
}

@Controller("goghdi/config")
export class GoghdiPublicConfigController {
  constructor(private readonly settings: GoghdiSettingsService) {}

  @Get()
  @Header("Cache-Control", "public, max-age=60")
  get(): Promise<GoghdiPublicConfig> {
    return this.settings.getPublic();
  }
}

@Controller("admin/settings/goghdi")
@UseGuards(PlatformAdminGuard)
export class GoghdiSettingsController {
  constructor(
    private readonly settings: GoghdiSettingsService,
    private readonly rateLimits: AuthRateLimitService
  ) {}

  @Get()
  get(): Promise<AdminGoghdiSettings> {
    return this.settings.getAdmin();
  }

  @Patch()
  async update(
    @Body() body: UpdateGoghdiSettingsDto,
    @Req() request: AuthenticatedRequest,
    @Ip() clientIp: string
  ): Promise<AdminGoghdiSettings> {
    await this.rateLimits.consumeGoghdiConfiguration(request.authenticatedUser!.id, clientIp);
    return this.settings.update(body, request.authenticatedUser!.id);
  }
}
