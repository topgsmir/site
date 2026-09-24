import { Body, Controller, Delete, Get, Ip, Param, ParseUUIDPipe, Patch, Post, Req, UploadedFile, UseGuards, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { AuthRateLimitService } from "../auth/auth-rate-limit.service";
import { type AuthenticatedRequest } from "../auth/platform-admin.guard";
import { PlatformPermissionGuard } from "../auth/platform-permission.guard";
import { RequirePlatformPermission } from "../auth/platform-permission.decorator";
import { CreateVendorDto, UpdateVendorDto } from "./dto/vendor.dto";
import {
  CreateSellerAgentDto,
  CreateSellerInviteDto,
  UpdateSellerPublicProfileDto
} from "./dto/seller-directory.dto";
import { SellerProfileGuard } from "./seller-profile.guard";
import { SellerService } from "./seller.service";
import { MediaService } from "../media/media.service";

@Controller("seller")
export class SellerController {
  constructor(
    private readonly sellerService: SellerService,
    private readonly rateLimits: AuthRateLimitService,
    private readonly media: MediaService
  ) {}

  @Get("vendors")
  @RequirePlatformPermission("vendors_manage")
  @UseGuards(PlatformPermissionGuard)
  async listVendors(@Req() request: AuthenticatedRequest, @Ip() clientIp: string) {
    await this.rateLimits.consumeSellerOperation(request.authenticatedUser!.id, clientIp);
    return this.sellerService.listVendors();
  }

  @Post("vendors")
  @RequirePlatformPermission("vendors_manage")
  @UseGuards(PlatformPermissionGuard)
  async createVendor(
    @Body() body: CreateVendorDto,
    @Req() request: AuthenticatedRequest,
    @Ip() clientIp: string
  ) {
    await this.rateLimits.consumeSellerOperation(request.authenticatedUser!.id, clientIp);
    return this.sellerService.createVendor(
      body,
      request.authenticatedUser!.id
    );
  }

  @Patch("vendors/:id")
  @RequirePlatformPermission("vendors_manage")
  @UseGuards(PlatformPermissionGuard)
  async updateVendor(
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() body: UpdateVendorDto,
    @Req() request: AuthenticatedRequest,
    @Ip() clientIp: string
  ) {
    await this.rateLimits.consumeSellerOperation(request.authenticatedUser!.id, clientIp);
    return this.sellerService.updateVendor(
      id,
      body,
      request.authenticatedUser!.id
    );
  }

  @Get("agents")
  @RequirePlatformPermission("vendors_manage")
  @UseGuards(PlatformPermissionGuard)
  async listAgents(@Req() request: AuthenticatedRequest, @Ip() clientIp: string) {
    await this.rateLimits.consumeSellerOperation(request.authenticatedUser!.id, clientIp);
    return this.sellerService.listAgents();
  }

  @Get("directory")
  listPublicSellers() {
    return this.sellerService.listPublicSellers();
  }

  @Get("directory/:id")
  getPublicSeller(@Param("id", new ParseUUIDPipe({ version: "4" })) id: string) {
    return this.sellerService.getPublicSeller(id);
  }

  @Get("profile")
  @UseGuards(SellerProfileGuard)
  getOwnProfile(@Req() request: AuthenticatedRequest) {
    return this.sellerService.getOwnProfile(request.sellerContext!.sellerId);
  }

  @Patch("profile")
  @UseGuards(SellerProfileGuard)
  async updateOwnProfile(
    @Body() body: UpdateSellerPublicProfileDto,
    @Req() request: AuthenticatedRequest,
    @Ip() clientIp: string
  ) {
    await this.rateLimits.consumeSellerOperation(request.authenticatedUser!.id, clientIp);
    return this.sellerService.updateOwnProfile(
      request.sellerContext!.sellerId,
      request.sellerContext!.membershipRole,
      body
    );
  }

  @Post("profile/picture")
  @UseGuards(SellerProfileGuard)
  @UseInterceptors(FileInterceptor("file", { limits: { fileSize: 8 * 1024 * 1024, files: 1, fields: 0, parts: 1 } }))
  async uploadProfilePicture(
    @UploadedFile() file: Express.Multer.File | undefined,
    @Req() request: AuthenticatedRequest,
    @Ip() clientIp: string
  ) {
    await this.rateLimits.consumeMediaUpload(request.authenticatedUser!.id, clientIp);
    return this.media.uploadSellerProfilePicture(
      request.sellerContext!.sellerId,
      request.authenticatedUser!.id,
      request.sellerContext!.membershipRole,
      file
    );
  }

  @Delete("profile/picture")
  @UseGuards(SellerProfileGuard)
  async deleteProfilePicture(
    @Req() request: AuthenticatedRequest,
    @Ip() clientIp: string
  ) {
    await this.rateLimits.consumeSellerOperation(request.authenticatedUser!.id, clientIp);
    return this.media.deleteSellerProfilePicture(
      request.sellerContext!.sellerId,
      request.sellerContext!.membershipRole
    );
  }

  @Post("agents")
  @RequirePlatformPermission("vendors_manage")
  @UseGuards(PlatformPermissionGuard)
  async createAgent(
    @Body() body: CreateSellerAgentDto,
    @Req() request: AuthenticatedRequest,
    @Ip() clientIp: string
  ) {
    await this.rateLimits.consumeSellerOperation(request.authenticatedUser!.id, clientIp);
    return this.sellerService.createAgent(body, request.authenticatedUser!.id);
  }

  @Get("invites")
  @RequirePlatformPermission("vendors_manage")
  @UseGuards(PlatformPermissionGuard)
  async list(@Req() request: AuthenticatedRequest, @Ip() clientIp: string) {
    await this.rateLimits.consumeSellerOperation(request.authenticatedUser!.id, clientIp);
    return this.sellerService.listInvitations();
  }

  @Post("invites")
  @RequirePlatformPermission("vendors_manage")
  @UseGuards(PlatformPermissionGuard)
  async create(
    @Body() body: CreateSellerInviteDto,
    @Req() request: AuthenticatedRequest,
    @Ip() clientIp: string
  ) {
    await this.rateLimits.consumeSellerOperation(request.authenticatedUser!.id, clientIp);
    return this.sellerService.createInvitation(body, request.authenticatedUser!.id);
  }
}
