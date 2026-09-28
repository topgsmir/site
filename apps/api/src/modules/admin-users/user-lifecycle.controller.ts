import { Body, Controller, Get, Ip, Param, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { IsUUID } from "class-validator";
import { PlatformAdminGuard, type AuthenticatedRequest } from "../auth/platform-admin.guard";
import { BrowserSessionMutation } from "../auth/browser-session-mutation.decorator";
import { AuthRateLimitService } from "../auth/auth-rate-limit.service";
import { UserIdDto } from "./dto/admin-users.dto";
import { ChangeAccountStatusDto, ChangeUserRoleDto, CreateDeletionDto, DeletionQueryDto, LifecycleCandidateSearchDto, LifecycleSearchDto } from "./dto/user-lifecycle.dto";
import { UserLifecycleService } from "./user-lifecycle.service";
import { UserDeletionService } from "./user-deletion.service";
class JobParams extends UserIdDto { @IsUUID("4") jobId!: string }

@Controller("admin/users")
@UseGuards(PlatformAdminGuard)
export class UserLifecycleController {
  constructor(private readonly lifecycle: UserLifecycleService, private readonly deletions: UserDeletionService, private readonly limits: AuthRateLimitService) {}
  @Get(":id/access")
  access(@Param() p: UserIdDto) { return this.lifecycle.access(p.id); }
  @Get(":id/account-events")
  events(@Param() p: UserIdDto, @Query() q: LifecycleSearchDto) { return this.lifecycle.events(p.id, q); }
  @Get(":id/role-sellers")
  async sellers(@Param() p: UserIdDto, @Query() q: LifecycleSearchDto) { await this.lifecycle.access(p.id); return this.lifecycle.sellers(q); }
  @Get(":id/replacements")
  candidates(@Param() p: UserIdDto, @Query() q: LifecycleCandidateSearchDto) { return this.lifecycle.candidates(p.id, q); }
  @Get(":id/deletion-impact")
  async impact(@Param() p: UserIdDto, @Query() q: DeletionQueryDto, @Req() r: AuthenticatedRequest, @Ip() ip: string) {
    await this.limits.consumeAdminUserOperation(r.authenticatedUser!.id, ip);
    return this.deletions.impact(p.id, q.replacementUserId);
  }
  @Patch(":id/status")
  @BrowserSessionMutation()
  async status(@Param() p: UserIdDto, @Body() b: ChangeAccountStatusDto, @Req() r: AuthenticatedRequest, @Ip() ip: string) {
    await this.limits.consumeAdminUserOperation(r.authenticatedUser!.id, ip);
    return this.lifecycle.setStatus(p.id, r.authenticatedUser!.id, b);
  }
  @Patch(":id/role")
  @BrowserSessionMutation()
  async role(@Param() p: UserIdDto, @Body() b: ChangeUserRoleDto, @Req() r: AuthenticatedRequest, @Ip() ip: string) {
    await this.limits.consumeAdminUserOperation(r.authenticatedUser!.id, ip);
    return this.lifecycle.setRole(p.id, r.authenticatedUser!.id, b);
  }
  @Post(":id/deletion-jobs")
  @BrowserSessionMutation()
  async remove(@Param() p: UserIdDto, @Body() b: CreateDeletionDto, @Req() r: AuthenticatedRequest, @Ip() ip: string) {
    await this.limits.consumeAdminUserOperation(r.authenticatedUser!.id, ip);
    return this.deletions.enqueue(p.id, r.authenticatedUser!.id, b);
  }
  @Get(":id/deletion-jobs/:jobId")
  job(@Param() p: JobParams) { return this.deletions.job(p.id, p.jobId); }
  @Post(":id/deletion-jobs/:jobId/retry")
  @BrowserSessionMutation()
  async retry(@Param() p: JobParams, @Req() r: AuthenticatedRequest, @Ip() ip: string) {
    await this.limits.consumeAdminUserOperation(r.authenticatedUser!.id, ip);
    return this.deletions.retry(p.id, p.jobId, r.authenticatedUser!.id);
  }
}
