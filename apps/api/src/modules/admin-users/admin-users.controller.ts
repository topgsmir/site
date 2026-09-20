import { Body, Controller, Get, Param, Patch, Query, Req, UseGuards } from "@nestjs/common";
import { PlatformAdminGuard, type AuthenticatedRequest } from "../auth/platform-admin.guard";
import { BrowserSessionMutation } from "../auth/browser-session-mutation.decorator";
import { AdminUsersService } from "./admin-users.service";
import { AdminUserHistoryQueryDto, ListAdminUsersQueryDto, UpdateAdminUserDto, UserIdDto } from "./dto/admin-users.dto";

@Controller("admin/users")
@UseGuards(PlatformAdminGuard)
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Get()
  list(@Query() query: ListAdminUsersQueryDto) {
    return this.users.list(query);
  }

  @Get(":id")
  detail(@Param() params: UserIdDto) { return this.users.detail(params.id); }

  @Get(":id/history")
  history(@Param() params: UserIdDto, @Query() query: AdminUserHistoryQueryDto) {
    return this.users.history(params.id, query);
  }

  @Patch(":id")
  @BrowserSessionMutation()
  update(@Param() params: UserIdDto, @Body() body: UpdateAdminUserDto, @Req() request: AuthenticatedRequest) {
    return this.users.update(params.id, request.authenticatedUser!.id, body);
  }
}
