import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { PlatformAdminGuard } from "../auth/platform-admin.guard";
import { AdminUsersService } from "./admin-users.service";
import { ListAdminUsersQueryDto } from "./dto/admin-users.dto";

@Controller("admin/users")
@UseGuards(PlatformAdminGuard)
export class AdminUsersController {
  constructor(private readonly users: AdminUsersService) {}

  @Get()
  list(@Query() query: ListAdminUsersQueryDto) {
    return this.users.list(query);
  }
}
