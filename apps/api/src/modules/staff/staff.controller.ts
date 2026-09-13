import { Body, Controller, Delete, Get, Ip, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { AuthRateLimitService } from "../auth/auth-rate-limit.service";
import { PlatformAdminGuard, type AuthenticatedRequest } from "../auth/platform-admin.guard";
import {
  CompleteStaffSetupDto,
  CreateStaffInvitationDto,
  UpdateStaffDto
} from "./dto/staff.dto";
import { StaffService } from "./staff.service";

@Controller("admin/staff")
export class StaffController {
  constructor(
    private readonly staff: StaffService,
    private readonly rateLimits: AuthRateLimitService
  ) {}

  @Get()
  @UseGuards(PlatformAdminGuard)
  list() {
    return this.staff.list();
  }

  @Post()
  @UseGuards(PlatformAdminGuard)
  invite(
    @Body() body: CreateStaffInvitationDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.staff.invite(body, request.authenticatedUser!.id);
  }

  @Patch(":id")
  @UseGuards(PlatformAdminGuard)
  update(
    @Param("id") id: string,
    @Body() body: UpdateStaffDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.staff.update(id, body, request.authenticatedUser!.id);
  }

  @Delete(":id")
  @UseGuards(PlatformAdminGuard)
  revoke(@Param("id") id: string) {
    return this.staff.revoke(id);
  }

  @Post("setup/:token")
  async completeSetup(
    @Param("token") token: string,
    @Body() body: CompleteStaffSetupDto,
    @Ip() clientIp: string
  ) {
    await this.rateLimits.consumeStaffSetup(token, clientIp);
    return this.staff.completeSetup(token, body);
  }
}
