import { Body, Controller, Get, Ip, Param, ParseUUIDPipe, Patch, Post, Put, Query, Req, UseGuards } from "@nestjs/common";
import { AuthRateLimitService } from "../auth/auth-rate-limit.service";
import { IdempotencyKey } from "../auth/idempotency-key.decorator";
import { PlatformAdminGuard, type AuthenticatedRequest } from "../auth/platform-admin.guard";
import { ClubAdminService } from "./club-admin.service";
import { ClubService } from "./club.service";
import { ClubAdjustDto, ClubCampaignDto, ClubHistoryQueryDto, ClubOverrideDto, ClubRewardDto, ClubSettingsDto, ClubTierDto } from "./dto/club.dto";

@Controller("admin/club")
@UseGuards(PlatformAdminGuard)
export class ClubAdminController {
  constructor(private readonly admin: ClubAdminService, private readonly club: ClubService, private readonly rateLimits: AuthRateLimitService) {}

  @Get("settings") settings() { return this.club.settings(); }
  @Patch("settings") updateSettings(@Req() request: AuthenticatedRequest, @Body() body: ClubSettingsDto) { return this.admin.updateSettings(request.authenticatedUser!.id, body); }
  @Get("tiers") tiers() { return this.admin.tiers(); }
  @Post("tiers") createTier(@Req() request: AuthenticatedRequest, @Body() body: ClubTierDto) { return this.admin.putTier(request.authenticatedUser!.id, null, body); }
  @Put("tiers/:id") updateTier(@Req() request: AuthenticatedRequest, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Body() body: ClubTierDto) { return this.admin.putTier(request.authenticatedUser!.id, id, body); }
  @Get("rewards") rewards() { return this.admin.rewards(); }
  @Post("rewards") createReward(@Req() request: AuthenticatedRequest, @Body() body: ClubRewardDto) { return this.admin.putReward(request.authenticatedUser!.id, null, body); }
  @Put("rewards/:id") updateReward(@Req() request: AuthenticatedRequest, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Body() body: ClubRewardDto) { return this.admin.putReward(request.authenticatedUser!.id, id, body); }
  @Get("campaigns") campaigns() { return this.admin.campaigns(); }
  @Post("campaigns") createCampaign(@Req() request: AuthenticatedRequest, @Body() body: ClubCampaignDto) { return this.admin.putCampaign(request.authenticatedUser!.id, null, body); }
  @Put("campaigns/:id") updateCampaign(@Req() request: AuthenticatedRequest, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Body() body: ClubCampaignDto) { return this.admin.putCampaign(request.authenticatedUser!.id, id, body); }
  @Get("members") members(@Query() query: ClubHistoryQueryDto) { return this.admin.members(query.cursor, query.limit); }
  @Get("members/:id") member(@Param("id", new ParseUUIDPipe({ version: "4" })) id: string) { return this.club.summary(id); }
  @Get("members/:id/history") history(@Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Query() query: ClubHistoryQueryDto) { return this.club.history(id, query.cursor, query.limit); }
  @Post("members/:id/adjustments") async adjust(@Req() request: AuthenticatedRequest, @Ip() ip: string, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Body() body: ClubAdjustDto, @IdempotencyKey() key: string) {
    await this.rateLimits.consumePaymentRefund(request.authenticatedUser!.id, ip);
    return this.admin.adjust(request.authenticatedUser!.id, id, body, key);
  }
  @Post("members/:id/tier-overrides") async override(@Req() request: AuthenticatedRequest, @Ip() ip: string, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Body() body: ClubOverrideDto) {
    await this.rateLimits.consumeOrderMutation(request.authenticatedUser!.id, ip);
    return this.admin.override(request.authenticatedUser!.id, id, body);
  }
  @Get("reports") reports() { return this.admin.reports(); }
}
