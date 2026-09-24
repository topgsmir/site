import { Body, Controller, Delete, Get, Ip, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { ParseConstrainedStringPipe } from "../../common/http/parse-constrained-string.pipe";
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
  async invite(
    @Body() body: CreateStaffInvitationDto,
    @Req() request: AuthenticatedRequest,
    @Ip() clientIp: string
  ) {
    await this.rateLimits.consumeStaffAdmin(request.authenticatedUser!.id, clientIp);
    return this.staff.invite(body, request.authenticatedUser!.id);
  }

  @Patch(":id")
  @UseGuards(PlatformAdminGuard)
  async update(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() body: UpdateStaffDto,
    @Req() request: AuthenticatedRequest,
    @Ip() clientIp: string
  ) {
    await this.rateLimits.consumeStaffAdmin(request.authenticatedUser!.id, clientIp);
    return this.staff.update(id, body, request.authenticatedUser!.id);
  }

  @Delete(":id")
  @UseGuards(PlatformAdminGuard)
  async revoke(@Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Req() request: AuthenticatedRequest, @Ip() clientIp: string) {
    await this.rateLimits.consumeStaffAdmin(request.authenticatedUser!.id, clientIp);
    return this.staff.revoke(id);
  }

  @Post("setup/:token")
  async completeSetup(
    @Param("token", new ParseConstrainedStringPipe({ label: "Invitation token", minLength: 43, maxLength: 43, pattern: /^[A-Za-z0-9_-]{43}$/ })) token: string,
    @Body() body: CompleteStaffSetupDto,
    @Ip() clientIp: string
  ) {
    await this.rateLimits.consumeStaffSetup(token, clientIp);
    return this.staff.completeSetup(token, body);
  }
}
