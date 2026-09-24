import { Body, Controller, Get, Header, Ip, Param, ParseUUIDPipe, Put, Post, Query, Req, StreamableFile, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { AuthRateLimitService } from "../auth/auth-rate-limit.service";
import { BrowserSessionMutation } from "../auth/browser-session-mutation.decorator";
import { PlatformAdminGuard, type AuthenticatedRequest } from "../auth/platform-admin.guard";
import { HomepageLocaleDto, SaveHomepageDto } from "./homepage.dto";
import { HomepageService } from "./homepage.service";
import { HomepageImagesService } from "./homepage-images.service";

@Controller("homepage")
export class PublicHomepageController {
  constructor(private readonly homepage: HomepageService, private readonly images: HomepageImagesService) {}
  @Get() @Header("Cache-Control", "no-store")
  get(@Query() query: HomepageLocaleDto) { return this.homepage.get(query.locale); }

  @Get("images/:id")
  @Header("Content-Type", "image/webp")
  @Header("X-Content-Type-Options", "nosniff")
  @Header("Cache-Control", "public, max-age=31536000, immutable")
  async image(@Param("id", new ParseUUIDPipe({ version: "4" })) id: string) {
    return new StreamableFile(await this.images.get(id));
  }
}

@Controller("admin/homepage")
@UseGuards(PlatformAdminGuard)
export class AdminHomepageController {
  constructor(private readonly homepage: HomepageService, private readonly images: HomepageImagesService, private readonly limits: AuthRateLimitService) {}
  @Get() @Header("Cache-Control", "private, no-store")
  get(@Query() query: HomepageLocaleDto) { return this.homepage.get(query.locale); }

  @Put() @BrowserSessionMutation()
  async save(@Query() query: HomepageLocaleDto, @Body() body: SaveHomepageDto, @Req() request: AuthenticatedRequest, @Ip() ip: string) {
    await this.limits.consumeMediaAdmin(request.authenticatedUser!.id, ip);
    return this.homepage.save(query.locale, body, request.authenticatedUser!.id);
  }

  @Post("images") @BrowserSessionMutation()
  // Busboy counts the closing multipart boundary; files/fields enforce the actual payload count.
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0, parts: 2 } }))
  async upload(@UploadedFile() file: Express.Multer.File | undefined, @Req() request: AuthenticatedRequest, @Ip() ip: string) {
    await this.limits.consumeMediaUpload(request.authenticatedUser!.id, ip);
    return this.images.upload(file);
  }
}
