import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { type AuthenticatedRequest } from "../auth/platform-admin.guard";
import { PlatformPermissionGuard } from "../auth/platform-permission.guard";
import { RequirePlatformPermission } from "../auth/platform-permission.decorator";
import { CreateVendorDto, UpdateVendorDto } from "./dto/vendor.dto";
import {
  CreateSellerAgentDto,
  CreateSellerInviteDto
} from "./dto/seller-directory.dto";
import { SellerService } from "./seller.service";

@Controller("seller")
export class SellerController {
  constructor(private readonly sellerService: SellerService) {}

  @Get("vendors")
  @RequirePlatformPermission("vendors_manage")
  @UseGuards(PlatformPermissionGuard)
  listVendors() {
    return this.sellerService.listVendors();
  }

  @Post("vendors")
  @RequirePlatformPermission("vendors_manage")
  @UseGuards(PlatformPermissionGuard)
  createVendor(
    @Body() body: CreateVendorDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.sellerService.createVendor(
      body,
      request.authenticatedUser!.id
    );
  }

  @Patch("vendors/:id")
  @RequirePlatformPermission("vendors_manage")
  @UseGuards(PlatformPermissionGuard)
  updateVendor(
    @Param("id") id: string,
    @Body() body: UpdateVendorDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.sellerService.updateVendor(
      id,
      body,
      request.authenticatedUser!.id
    );
  }

  @Get("agents")
  listAgents() {
    return this.sellerService.listAgents();
  }

  @Post("agents")
  @RequirePlatformPermission("vendors_manage")
  @UseGuards(PlatformPermissionGuard)
  createAgent(
    @Body() body: CreateSellerAgentDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.sellerService.createAgent(body, request.authenticatedUser!.id);
  }

  @Get("invites")
  @RequirePlatformPermission("vendors_manage")
  @UseGuards(PlatformPermissionGuard)
  list() {
    return this.sellerService.listInvitations();
  }

  @Post("invites")
  @RequirePlatformPermission("vendors_manage")
  @UseGuards(PlatformPermissionGuard)
  create(
    @Body() body: CreateSellerInviteDto,
    @Req() request: AuthenticatedRequest
  ) {
    return this.sellerService.createInvitation(body, request.authenticatedUser!.id);
  }
}
