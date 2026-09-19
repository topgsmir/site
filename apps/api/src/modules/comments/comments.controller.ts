import { Body, Controller, ForbiddenException, Get, Ip, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { AuthService } from "../auth/auth.service";
import { AuthenticatedGuard } from "../auth/authenticated.guard";
import { AuthRateLimitService } from "../auth/auth-rate-limit.service";
import { PlatformAdminGuard, type AuthenticatedRequest } from "../auth/platform-admin.guard";
import { readSessionToken } from "../auth/session-token";
import { CommentsService } from "./comments.service";
import { SecurityPolicyService } from "../auth/security-policy.service";
import { CaptchaService } from "../captcha/captcha.service";
import { AdminListCommentsDto, CreateCommentDto, ListCommentsDto, ReplyCommentDto, UpdateCommentSettingsDto } from "./dto/comment.dto";

const uuid = new ParseUUIDPipe({ version: "4" });

@Controller("comments")
export class CommentsController {
  constructor(private readonly comments: CommentsService, private readonly auth: AuthService, private readonly limits: AuthRateLimitService, private readonly policies: SecurityPolicyService, private readonly captcha: CaptchaService) {}

  @Get("settings")
  async publicSettings() {
    const { postingPolicy, publicationPolicy } = await this.comments.getSettings();
    return { postingPolicy, publicationPolicy };
  }

  @Get("products/:productId")
  listPublic(@Param("productId", uuid) productId: string, @Query() query: ListCommentsDto) {
    return this.comments.listPublic(productId, query);
  }

  @Post("products/:productId")
  async create(@Param("productId", uuid) productId: string, @Body() body: CreateCommentDto, @Req() request: AuthenticatedRequest, @Ip() ip: string) {
    const token = readSessionToken(request.headers.cookie, request.headers.authorization);
    const user = token ? await this.auth.getUserFromToken(token) : null;
    await this.limits.consumeCommentSubmit(user?.id ?? null, productId, ip);
    if (!user && (await this.policies.get("comment_submit_guest")).captchaEnabled) {
      if (!body.captchaToken) throw new ForbiddenException("Captcha verification required");
      await this.captcha.verify(body.captchaToken, "comment_submit_guest");
    }
    return this.comments.create(productId, body, user);
  }

  @Get("seller/status")
  @UseGuards(AuthenticatedGuard)
  status(@Req() request: AuthenticatedRequest) { return this.comments.lockStatus(request.authenticatedUser!); }

  @Get("seller")
  @UseGuards(AuthenticatedGuard)
  listSeller(@Req() request: AuthenticatedRequest, @Query() query: ListCommentsDto) { return this.comments.listSeller(request.authenticatedUser!, query); }

  @Post("seller/:commentId/reply")
  @UseGuards(AuthenticatedGuard)
  async reply(@Req() request: AuthenticatedRequest, @Ip() ip: string, @Param("commentId", uuid) id: string, @Body() body: ReplyCommentDto) {
    await this.limits.consumeCommentReply(request.authenticatedUser!.id, ip);
    return this.comments.reply(request.authenticatedUser!, id, body.body);
  }

  @Post("seller/:commentId/flag")
  @UseGuards(AuthenticatedGuard)
  async flag(@Req() request: AuthenticatedRequest, @Ip() ip: string, @Param("commentId", uuid) id: string) {
    await this.limits.consumeCommentReply(request.authenticatedUser!.id, ip);
    return this.comments.flag(request.authenticatedUser!, id);
  }
}

@Controller("admin/settings/comments")
@UseGuards(PlatformAdminGuard)
export class AdminCommentsController {
  constructor(private readonly comments: CommentsService, private readonly limits: AuthRateLimitService) {}

  @Get("settings")
  settings() { return this.comments.getSettings(); }

  @Patch("settings")
  async updateSettings(@Req() request: AuthenticatedRequest, @Ip() ip: string, @Body() body: UpdateCommentSettingsDto) {
    await this.limits.consumeCommentAdmin(request.authenticatedUser!.id, ip);
    return this.comments.updateSettings(body, request.authenticatedUser!.id);
  }

  @Get()
  list(@Query() query: AdminListCommentsDto) { return this.comments.listAdmin(query); }

  @Post(":id/approve")
  async approve(@Req() request: AuthenticatedRequest, @Ip() ip: string, @Param("id", uuid) id: string) { await this.limits.consumeCommentAdmin(request.authenticatedUser!.id, ip); return this.comments.moderate(id, "approve", request.authenticatedUser!.id); }

  @Post(":id/reject")
  async reject(@Req() request: AuthenticatedRequest, @Ip() ip: string, @Param("id", uuid) id: string) { await this.limits.consumeCommentAdmin(request.authenticatedUser!.id, ip); return this.comments.moderate(id, "reject", request.authenticatedUser!.id); }

  @Post(":id/spam")
  async spam(@Req() request: AuthenticatedRequest, @Ip() ip: string, @Param("id", uuid) id: string) { await this.limits.consumeCommentAdmin(request.authenticatedUser!.id, ip); return this.comments.moderate(id, "spam", request.authenticatedUser!.id); }

  @Post(":id/restore")
  async restore(@Req() request: AuthenticatedRequest, @Ip() ip: string, @Param("id", uuid) id: string) { await this.limits.consumeCommentAdmin(request.authenticatedUser!.id, ip); return this.comments.moderate(id, "restore", request.authenticatedUser!.id); }
}
