import { Body, Controller, Get, Ip, Patch, Req, UseGuards } from "@nestjs/common";
import { AuthRateLimitService } from "../auth/auth-rate-limit.service";
import { PlatformAdminGuard, type AuthenticatedRequest } from "../auth/platform-admin.guard";
import { UpdatePlatformNoticeDto } from "./dto/update-platform-notice.dto";
import { PlatformNoticeService } from "./platform-notice.service";

@Controller("notice")
export class PublicNoticeController {
  constructor(private readonly notices: PlatformNoticeService) {}
  @Get()
  get() { return this.notices.getPublic(); }
}

@Controller("admin/settings/notice")
@UseGuards(PlatformAdminGuard)
export class AdminNoticeController {
  constructor(private readonly notices: PlatformNoticeService, private readonly rateLimits: AuthRateLimitService) {}
  @Get()
  get() { return this.notices.getAdmin(); }
  @Patch()
  async update(@Body() body: UpdatePlatformNoticeDto, @Req() request: AuthenticatedRequest, @Ip() clientIp: string) {
    await this.rateLimits.consumeNoticeConfiguration(request.authenticatedUser!.id, clientIp);
    return this.notices.update(body);
  }
}
