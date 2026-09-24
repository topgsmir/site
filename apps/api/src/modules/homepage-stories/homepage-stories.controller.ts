import { Body, Controller, Delete, Get, Ip, Param, ParseUUIDPipe, Patch, Post, Query, Req, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { AuthRateLimitService } from "../auth/auth-rate-limit.service";
import { BrowserSessionMutation } from "../auth/browser-session-mutation.decorator";
import { PlatformAdminGuard, type AuthenticatedRequest } from "../auth/platform-admin.guard";
import { HomepageStoriesQueryDto, SaveHomepageStoryDto } from "./dto/homepage-story.dto";
import { HomepageStoriesService } from "./homepage-stories.service";

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024;

@Controller("stories")
export class PublicHomepageStoriesController {
  constructor(private readonly stories: HomepageStoriesService) {}

  @Get()
  list(@Query() query: HomepageStoriesQueryDto) {
    return this.stories.listPublic(query);
  }
}

@Controller("admin/stories")
@UseGuards(PlatformAdminGuard)
export class AdminHomepageStoriesController {
  constructor(private readonly stories: HomepageStoriesService, private readonly rateLimits: AuthRateLimitService) {}

  @Get()
  list(@Query() query: HomepageStoriesQueryDto) {
    return this.stories.listAdmin(query);
  }

  @Post()
  @BrowserSessionMutation()
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 5, parts: 6, fieldSize: 4_096 } }))
  async create(@Body() body: SaveHomepageStoryDto, @UploadedFile() file: Express.Multer.File | undefined, @Ip() clientIp: string, @Req() request: AuthenticatedRequest) {
    await this.rateLimits.consumeMediaUpload(request.authenticatedUser!.id, clientIp);
    return this.stories.create(request.authenticatedUser!.id, body, file);
  }

  @Patch(":id")
  @BrowserSessionMutation()
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: MAX_UPLOAD_BYTES, files: 1, fields: 5, parts: 6, fieldSize: 4_096 } }))
  async update(@Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Body() body: SaveHomepageStoryDto, @UploadedFile() file: Express.Multer.File | undefined, @Ip() clientIp: string, @Req() request: AuthenticatedRequest) {
    await this.rateLimits.consumeMediaAdmin(request.authenticatedUser!.id, clientIp);
    if (file) await this.rateLimits.consumeMediaUpload(request.authenticatedUser!.id, clientIp);
    return this.stories.update(id, request.authenticatedUser!.id, body, file);
  }

  @Delete(":id")
  @BrowserSessionMutation()
  async remove(@Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Ip() clientIp: string, @Req() request: AuthenticatedRequest) {
    await this.rateLimits.consumeMediaAdmin(request.authenticatedUser!.id, clientIp);
    return this.stories.remove(id);
  }
}
