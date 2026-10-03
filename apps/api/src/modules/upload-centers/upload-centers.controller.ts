import { Body, Controller, Get, Ip, Patch, Req, UseGuards } from "@nestjs/common";
import { AuthRateLimitService } from "../auth/auth-rate-limit.service";
import { PlatformAdminGuard, type AuthenticatedRequest } from "../auth/platform-admin.guard";
import { UpdateUploadCentersDto } from "./dto/update-upload-centers.dto";
import { UploadCentersService } from "./upload-centers.service";

@Controller("upload-centers")
export class UploadCentersController {
  constructor(private readonly centers: UploadCentersService) {}
  @Get()
  get() { return this.centers.get(); }
}

@Controller("admin/settings/upload-centers")
@UseGuards(PlatformAdminGuard)
export class AdminUploadCentersController {
  constructor(private readonly centers: UploadCentersService, private readonly rateLimits: AuthRateLimitService) {}
  @Get()
  get() { return this.centers.get(); }
  @Patch()
  async update(@Body() body: UpdateUploadCentersDto, @Req() request: AuthenticatedRequest, @Ip() clientIp: string) {
    await this.rateLimits.consumeUploadCenterConfiguration(request.authenticatedUser!.id, clientIp);
    return this.centers.update(body);
  }
}
