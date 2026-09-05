import { Body, Controller, Get, Post } from "@nestjs/common";

type CreateSellerInviteDto = {
  ownerName: string;
  ownerEmail: string;
  phoneNumber: string;
};

const invitedSellers: Array<CreateSellerInviteDto & { status: "invited" | "active" }> = [];

@Controller("seller")
export class SellerController {
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

