import { Body, Controller, Get, Ip, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { AuthRateLimitService } from "../auth/auth-rate-limit.service";
import { AuthService } from "../auth/auth.service";
import { PlatformAdminGuard, type AuthenticatedRequest } from "../auth/platform-admin.guard";
import { BrowserSessionMutation } from "../auth/browser-session-mutation.decorator";
import { AdminUsersService } from "./admin-users.service";
import { AdminUserHistoryQueryDto, ChangeAdminUserPasswordDto, CreateAdminUserDto, ListAdminUsersQueryDto, UpdateAdminUserDto, UserIdDto } from "./dto/admin-users.dto";

@Controller("admin/users")
@UseGuards(PlatformAdminGuard)
export class AdminUsersController {
  constructor(
    private readonly users: AdminUsersService,
    private readonly rateLimits: AuthRateLimitService,
    private readonly auth: AuthService
  ) {}

  @Get()
  list(@Query() query: ListAdminUsersQueryDto) {
    return this.users.list(query);
  }

  @Post()
  @BrowserSessionMutation()
  async create(@Body() body: CreateAdminUserDto, @Req() request: AuthenticatedRequest, @Ip() clientIp: string) {
    const actorId = request.authenticatedUser!.id;
    await this.rateLimits.consumeAdminUserOperation(actorId, clientIp);
    return this.users.create(actorId, body);
  }

  @Get(":id")
  detail(@Param() params: UserIdDto) { return this.users.detail(params.id); }

  @Get(":id/history")
  history(@Param() params: UserIdDto, @Query() query: AdminUserHistoryQueryDto) {
    return this.users.history(params.id, query);
  }

  @Patch(":id")
  @BrowserSessionMutation()
  async update(@Param() params: UserIdDto, @Body() body: UpdateAdminUserDto, @Req() request: AuthenticatedRequest, @Ip() clientIp: string) {
    await this.rateLimits.consumeAdminUserOperation(request.authenticatedUser!.id, clientIp);
    return this.users.update(params.id, request.authenticatedUser!.id, body);
  }

  @Patch(":id/password")
  @BrowserSessionMutation()
  async changePassword(@Param() params: UserIdDto, @Body() body: ChangeAdminUserPasswordDto, @Req() request: AuthenticatedRequest, @Ip() clientIp: string) {
    const actorId = request.authenticatedUser!.id;
    await this.rateLimits.consumeAdminUserOperation(actorId, clientIp);
    await this.auth.verifyCurrentPassword(actorId, body.currentPassword);
    return this.users.changePassword(params.id, actorId, body.newPassword);
  }
}
