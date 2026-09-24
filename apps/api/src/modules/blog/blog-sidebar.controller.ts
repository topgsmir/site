import { Body, Controller, Get, Header, Ip, Put, Query, Req, UseGuards } from "@nestjs/common";
import { AuthRateLimitService } from "../auth/auth-rate-limit.service";
import { BrowserSessionMutation } from "../auth/browser-session-mutation.decorator";
import { PlatformAdminGuard, type AuthenticatedRequest } from "../auth/platform-admin.guard";
import { BlogSidebarLocaleDto, SaveBlogSidebarDto } from "./blog-sidebar.dto";
import { BlogSidebarService } from "./blog-sidebar.service";

@Controller("blog/sidebar")
export class PublicBlogSidebarController {
  constructor(private readonly sidebar: BlogSidebarService) {}

  @Get()
  get(@Query() query: BlogSidebarLocaleDto) {
    return this.sidebar.get(query.locale);
  }
}

@Controller("admin/blog-sidebar")
@UseGuards(PlatformAdminGuard)
export class AdminBlogSidebarController {
  constructor(private readonly sidebar: BlogSidebarService, private readonly rateLimits: AuthRateLimitService) {}

  @Get()
  @Header("Cache-Control", "private, no-store")
  get(@Query() query: BlogSidebarLocaleDto) {
    return this.sidebar.get(query.locale);
  }

  @Put()
  @BrowserSessionMutation()
  async save(
    @Query() query: BlogSidebarLocaleDto,
    @Body() body: SaveBlogSidebarDto,
    @Req() request: AuthenticatedRequest,
    @Ip() clientIp: string
  ) {
    await this.rateLimits.consumeBlogMutation(request.authenticatedUser!.id, clientIp);
    return this.sidebar.save(query.locale, body, request.authenticatedUser!.id);
  }
}
