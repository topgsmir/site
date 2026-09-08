import {
  Controller,
  Get,
  Headers,
  Ip,
  Param,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
  Body
} from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { AuthRateLimitService } from "../auth/auth-rate-limit.service";
import type { AuthenticatedRequest } from "../auth/platform-admin.guard";
import { RequestAuthenticationService } from "../auth/request-authentication.service";
import { BlogManageGuard } from "../blog/blog-manage.guard";
import { UploadBlogMediaDto } from "./dto/media.dto";
import { MediaService } from "./media.service";

type HttpResponse = {
  setHeader(name: string, value: string): void;
  status(code: number): HttpResponse;
  end(): unknown;
  send(body: Buffer): unknown;
};

@Controller()
export class MediaController {
  constructor(
    private readonly media: MediaService,
    private readonly rateLimits: AuthRateLimitService,
    private readonly authentication: RequestAuthenticationService
  ) {}

  @Post("blog/media")
  @UseGuards(BlogManageGuard)
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 8 * 1024 * 1024, files: 1 } }))
  async upload(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() body: UploadBlogMediaDto,
    @Ip() clientIp: string,
    @Req() request: AuthenticatedRequest
  ) {
    await this.rateLimits.consumeMediaUpload(request.authenticatedUser!.id, clientIp);
    return this.media.upload(request.blogActor!, file, body);
  }

  @Get("media/:assetId/:filename")
  async serve(
    @Param("assetId") assetId: string,
    @Param("filename") filename: string,
    @Headers("if-none-match") ifNoneMatch: string | undefined,
    @Req() request: AuthenticatedRequest,
    @Res() response: HttpResponse
  ) {
    if (!/^[a-z0-9-]+\.webp$/.test(filename)) {
      return response.status(404).end();
    }
    const variant = filename.slice(0, -5);
    let user;
    try {
      user = await this.authentication.authenticate(request);
    } catch {
      user = undefined;
    }
    const result = await this.media.get(assetId, variant, user);
    response.setHeader("Content-Type", "image/webp");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("ETag", result.etag);
    response.setHeader(
      "Cache-Control",
      result.published ? "public, max-age=31536000, immutable" : "private, no-store"
    );
    if (ifNoneMatch === result.etag) return response.status(304).end();
    return response.send(result.buffer);
  }
}
