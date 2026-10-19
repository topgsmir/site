import { Body, Controller, Get, Ip, Patch, Req, UseGuards } from "@nestjs/common";
import { AuthRateLimitService } from "../auth/auth-rate-limit.service";
import { PlatformAdminGuard, type AuthenticatedRequest } from "../auth/platform-admin.guard";
import { UpdateComplaintsSettingsDto } from "./dto/update-complaints-settings.dto";
import { ComplaintsService } from "./complaints.service";

@Controller("complaints")
export class PublicComplaintsController {
  constructor(private readonly complaints: ComplaintsService) {}
  @Get()
  get() { return this.complaints.get(); }
}

@Controller("admin/settings/complaints")
@UseGuards(PlatformAdminGuard)
export class AdminComplaintsController {
  constructor(private readonly complaints: ComplaintsService, private readonly rateLimits: AuthRateLimitService) {}
  @Get()
  get() { return this.complaints.get(); }
  @Patch()
  async update(@Body() body: UpdateComplaintsSettingsDto, @Req() request: AuthenticatedRequest, @Ip() clientIp: string) {
    await this.rateLimits.consumeComplaintsConfiguration(request.authenticatedUser!.id, clientIp);
    return this.complaints.update(body);
  }
}
