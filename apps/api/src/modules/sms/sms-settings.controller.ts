import { Body, Controller, Delete, Get, Ip, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import type { AdminSmsSettings } from "@topgsm/shared-types";
import { AuthRateLimitService } from "../auth/auth-rate-limit.service";
import type { AuthenticatedRequest } from "../auth/platform-admin.guard";
import { PlatformAdminGuard } from "../auth/platform-admin.guard";
import { UpdateSmsSettingsDto } from "./dto/sms-settings.dto";
import { SaveSmsRuleDto, SmsDeliveryQueryDto } from "./dto/sms-rule.dto";
import { SmsSettingsService } from "./sms-settings.service";
import { SmsRulesService } from "./sms-rules.service";

@Controller("admin/settings/sms")
@UseGuards(PlatformAdminGuard)
export class SmsSettingsController {
  constructor(
    private readonly settings: SmsSettingsService,
    private readonly rateLimits: AuthRateLimitService,
    private readonly rules: SmsRulesService
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

  @Get("rules")
  rulesList() { return this.rules.list(); }

  @Post("rules")
  async createRule(@Req() request: AuthenticatedRequest, @Ip() ip: string, @Body() body: SaveSmsRuleDto) {
    await this.rateLimits.consumeSmsConfiguration(request.authenticatedUser!.id, ip);
    return this.rules.save(body, request.authenticatedUser!.id);
  }

  @Patch("rules/:id")
  async updateRule(@Req() request: AuthenticatedRequest, @Ip() ip: string, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Body() body: SaveSmsRuleDto) {
    await this.rateLimits.consumeSmsConfiguration(request.authenticatedUser!.id, ip);
    return this.rules.save(body, request.authenticatedUser!.id, id);
  }

  @Delete("rules/:id")
  async deleteRule(@Req() request: AuthenticatedRequest, @Ip() ip: string, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string) {
    await this.rateLimits.consumeSmsConfiguration(request.authenticatedUser!.id, ip);
    return this.rules.remove(id, request.authenticatedUser!.id);
  }

  @Get("deliveries")
  deliveries(@Query() query: SmsDeliveryQueryDto) { return this.rules.deliveries(query); }
}
