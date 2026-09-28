import { Body, Controller, Get, Ip, Param, ParseEnumPipe, ParseUUIDPipe, Post, Query, Req, UseGuards } from "@nestjs/common";
import { AuthRateLimitService } from "../auth/auth-rate-limit.service";
import { BrowserSessionMutation } from "../auth/browser-session-mutation.decorator";
import type { AuthenticatedRequest } from "../auth/platform-admin.guard";
import { AdminUploadsService } from "./admin-uploads.service";
import { AdminUploadsQueryDto } from "./dto/admin-uploads.dto";
import { RequestUploadDeletionDto } from "./dto/seller-uploads.dto";
import { SellerUploadsGuard } from "./seller-uploads.guard";

@Controller("seller/uploads")
@UseGuards(SellerUploadsGuard)
export class SellerUploadsController {
  constructor(private readonly uploads: AdminUploadsService, private readonly rateLimits: AuthRateLimitService) {}

  @Get()
  async list(@Query() query: AdminUploadsQueryDto, @Ip() ip: string, @Req() request: AuthenticatedRequest) {
    await this.rateLimits.consumeMediaUpload(request.authenticatedUser!.id, ip);
    return this.uploads.listSeller(query, request.sellerContext!.sellerId);
  }

  @Get("summary")
  async summary(@Ip() ip: string, @Req() request: AuthenticatedRequest) {
    await this.rateLimits.consumeMediaUpload(request.authenticatedUser!.id, ip);
    return this.uploads.summary(request.sellerContext!.sellerId);
  }

  @Post(":source/:id/deletion-request")
  @BrowserSessionMutation()
  async requestDeletion(
    @Param("source", new ParseEnumPipe({ blog: "blog", product: "product" })) source: "blog" | "product",
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() body: RequestUploadDeletionDto, @Ip() ip: string, @Req() request: AuthenticatedRequest
  ) {
    await this.rateLimits.consumeMediaAdmin(request.authenticatedUser!.id, ip);
    return this.uploads.requestDeletion({ source, id }, request.sellerContext!.sellerId, request.authenticatedUser!.id, body.reason);
  }
}
