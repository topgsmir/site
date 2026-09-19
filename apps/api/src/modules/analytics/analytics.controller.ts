import { Controller, Get, Ip, Query, Req, UseGuards } from "@nestjs/common";
import { AuthenticatedGuard } from "../auth/authenticated.guard";
import { AuthRateLimitService } from "../auth/auth-rate-limit.service";
import type { AuthenticatedRequest } from "../auth/platform-admin.guard";
import { AnalyticsService } from "./analytics.service";
import { AnalyticsOverviewQueryDto } from "./dto/analytics.dto";

@Controller("analytics")
@UseGuards(AuthenticatedGuard)
export class AnalyticsController {
  constructor(
    private readonly analytics: AnalyticsService,
    private readonly rateLimits: AuthRateLimitService
  ) {}

  @Get("overview")
  async overview(
    @Req() request: AuthenticatedRequest,
    @Ip() clientIp: string,
    @Query() query: AnalyticsOverviewQueryDto
  ) {
    await this.rateLimits.consumeAnalyticsRead(request.authenticatedUser!.id, clientIp);
    return this.analytics.overview(request.authenticatedUser!, query);
  }
}
