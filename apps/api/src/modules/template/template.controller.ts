import { Body, Controller, Get, Header, Ip, Post, Put, Query, Req, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { AuthRateLimitService } from "../auth/auth-rate-limit.service";
import { BrowserSessionMutation } from "../auth/browser-session-mutation.decorator";
import { PlatformAdminGuard, type AuthenticatedRequest } from "../auth/platform-admin.guard";
import { HomepageImagesService } from "../homepage/homepage-images.service";
import { SaveTemplateSettingsDto, TemplateLocaleDto } from "./template.dto";
import { TemplateSettingsService } from "./template.service";

@Controller("template")
export class PublicTemplateController {
  constructor(private readonly settings: TemplateSettingsService) {}
  @Get() @Header("Cache-Control", "no-store")
  async get(@Query() query: TemplateLocaleDto) { return (await this.settings.get(query.locale)).configuration; }
}
@Controller("admin/settings/template")
@UseGuards(PlatformAdminGuard)
export class AdminTemplateController {
  constructor(private readonly settings: TemplateSettingsService, private readonly images: HomepageImagesService, private readonly limits: AuthRateLimitService) {}
  @Get() @Header("Cache-Control", "private, no-store")
  get(@Query() query: TemplateLocaleDto) { return this.settings.get(query.locale); }
  @Put() @BrowserSessionMutation()
  async save(@Query() query: TemplateLocaleDto, @Body() body: SaveTemplateSettingsDto, @Req() request: AuthenticatedRequest, @Ip() ip: string) {
    await this.limits.consumeMediaAdmin(request.authenticatedUser!.id, ip);
    return this.settings.save(query.locale, body, request.authenticatedUser!.id);
  }
  @Post("images") @BrowserSessionMutation()
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 0, parts: 2 } }))
  async upload(@UploadedFile() file: Express.Multer.File | undefined, @Req() request: AuthenticatedRequest, @Ip() ip: string) {
    await this.limits.consumeMediaUpload(request.authenticatedUser!.id, ip);
    return this.images.upload(file);
  }
}
