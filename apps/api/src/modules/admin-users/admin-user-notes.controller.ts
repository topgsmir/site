import { Body, Controller, Get, Header, Ip, Param, Post, Query, Req, UseGuards } from "@nestjs/common";
import { AuthRateLimitService } from "../auth/auth-rate-limit.service";
import { BrowserSessionMutation } from "../auth/browser-session-mutation.decorator";
import { PlatformAdminGuard, type AuthenticatedRequest } from "../auth/platform-admin.guard";
import { AdminUserNotesService } from "./admin-user-notes.service";
import { UserIdDto } from "./dto/admin-users.dto";
import { CreateUserNoteDto, UserNotesQueryDto } from "./dto/admin-user-notes.dto";

@Controller("admin/users")
@UseGuards(PlatformAdminGuard)
export class AdminUserNotesController {
  constructor(private readonly notes: AdminUserNotesService, private readonly rateLimits: AuthRateLimitService) {}

  @Get(":id/notes")
  @Header("Cache-Control", "private, no-store")
  list(@Param() params: UserIdDto, @Query() query: UserNotesQueryDto) {
    return this.notes.list(params.id, query);
  }

  @Post(":id/notes")
  @BrowserSessionMutation()
  async create(@Param() params: UserIdDto, @Body() body: CreateUserNoteDto, @Req() request: AuthenticatedRequest, @Ip() clientIp: string) {
    const actorId = request.authenticatedUser!.id;
    await this.rateLimits.consumeAdminUserOperation(actorId, clientIp);
    return this.notes.create(params.id, actorId, body.body, body.sellerVisible);
  }
}
