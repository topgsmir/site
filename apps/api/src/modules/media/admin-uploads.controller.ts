import { Body, Controller, Get, Ip, Param, ParseEnumPipe, ParseUUIDPipe, Post, Query, Req, UseGuards } from "@nestjs/common";
import { AuthRateLimitService } from "../auth/auth-rate-limit.service";
import { BrowserSessionMutation } from "../auth/browser-session-mutation.decorator";
import type { AuthenticatedRequest } from "../auth/platform-admin.guard";
import { RequirePlatformPermission } from "../auth/platform-permission.decorator";
import { PlatformPermissionGuard } from "../auth/platform-permission.guard";
import { AdminUploadsService } from "./admin-uploads.service";
import { AdminUploadsQueryDto, RestoreAdminUploadsDto, TrashAdminUploadsDto } from "./dto/admin-uploads.dto";

@Controller("admin/uploads")
@UseGuards(PlatformPermissionGuard)
@RequirePlatformPermission("uploads_manage")
export class AdminUploadsController {
  constructor(private readonly uploads: AdminUploadsService, private readonly rateLimits: AuthRateLimitService) {}

  @Get()
  async list(@Query() query: AdminUploadsQueryDto, @Ip() clientIp: string, @Req() request: AuthenticatedRequest) { await this.rateLimits.consumeMediaAdmin(request.authenticatedUser!.id, clientIp); return this.uploads.list(query); }

  @Get("summary")
  async summary(@Ip() clientIp: string, @Req() request: AuthenticatedRequest) { await this.rateLimits.consumeMediaAdmin(request.authenticatedUser!.id, clientIp); return this.uploads.summary(); }

  @Get(":source/:id")
  async detail(
    @Param("source", new ParseEnumPipe({ blog: "blog", product: "product" })) source: "blog" | "product",
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Ip() clientIp: string,
    @Req() request: AuthenticatedRequest
  ) {
    await this.rateLimits.consumeMediaAdmin(request.authenticatedUser!.id, clientIp);
    return this.uploads.detail(source, id);
  }

  @Post("trash")
  @BrowserSessionMutation()
  async trash(@Body() body: TrashAdminUploadsDto, @Ip() clientIp: string, @Req() request: AuthenticatedRequest) {
    await this.rateLimits.consumeMediaAdmin(request.authenticatedUser!.id, clientIp);
    return this.uploads.trash(body.items, body.reason, request.authenticatedUser!.id);
  }

  @Post("restore")
  @BrowserSessionMutation()
  async restore(@Body() body: RestoreAdminUploadsDto, @Ip() clientIp: string, @Req() request: AuthenticatedRequest) {
    await this.rateLimits.consumeMediaAdmin(request.authenticatedUser!.id, clientIp);
    return this.uploads.restore(body.items, request.authenticatedUser!.id);
  }
}
