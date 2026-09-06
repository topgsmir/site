import { Body, Controller, Get, Param, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { PlatformAdminGuard, type AuthenticatedRequest } from "../auth/platform-admin.guard";
import { CreateVendorDto, UpdateVendorDto } from "./dto/vendor.dto";
import { SellerService } from "./seller.service";

type CreateSellerInviteDto = {
  ownerName: string;
  ownerEmail: string;
  phoneNumber: string;
};

const invitedSellers: Array<CreateSellerInviteDto & { status: "invited" | "active" }> = [];

type Agent = {
  id: string;
  name: string;
  specialty: string;
  rating: number;
  phone?: string;
  available: boolean;
};

const agents: Agent[] = [
  { id: "nima-rasouli", name: "نیما رسولی", specialty: "کارشناس شیائومی", rating: 4.9, phone: "09925739310", available: true },
  { id: "ali-abdi", name: "علی عبدی", specialty: "کارشناس سامسونگ", rating: 4.8, phone: "09925739311", available: true },
  { id: "hesam-amini", name: "حسام امینی", specialty: "کارشناس عمومی", rating: 4.8, phone: "09925739313", available: false },
  { id: "hossein-kari", name: "حسین کاری", specialty: "متخصص برندهای چینی", rating: 4.7, phone: "09925739314", available: true },
  { id: "reza-rajabdoost", name: "رضا رجب‌دوست", specialty: "کارشناس سامسونگ", rating: 4.9, phone: "09925739320", available: true }
];

@Controller("seller")
export class SellerController {
  constructor(private readonly sellerService: SellerService) {}

  @Get("vendors")
  @UseGuards(PlatformAdminGuard)
  listVendors() {
    return this.sellerService.listVendors();
  }

  @Post("vendors")
  @UseGuards(PlatformAdminGuard)
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
  @UseGuards(PlatformAdminGuard)
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
    return agents;
  }

  @Post("agents")
  createAgent(@Body() body: Omit<Agent, "id">) {
    const agent = { ...body, id: `${Date.now()}` };
    agents.push(agent);
    return agent;
  }

  @Get("invites")
  list() {
    return invitedSellers;
  }

  @Post("invites")
  create(@Body() body: CreateSellerInviteDto) {
    const row = { ...body, status: "invited" as const };
    invitedSellers.push(row);
    return row;
  }
}
