import { Body, Controller, Get, Param, Patch, Post } from "@nestjs/common";
import { PayoutService } from "./payout.service";
import { PayoutStatus } from "@topgsm/shared-types";

type CreateRequestDto = {
  orderId: string;
  sellerId: string;
  requestedAmount: number;
};

type ApproveOrSettleDto = {
  status: PayoutStatus;
};

@Controller("payouts")
export class PayoutController {
  constructor(private readonly payoutService: PayoutService) {}

  @Get()
  list() {
    return this.payoutService.listAll();
  }

  @Get(":id")
  get(@Param("id") id: string) {
    return this.payoutService.get(id);
  }

  @Post("requests")
  requestPayout(@Body() body: CreateRequestDto) {
    return this.payoutService.request(body);
  }

  @Patch("requests/:id")
  setStatus(@Param("id") id: string, @Body() body: ApproveOrSettleDto) {
    return this.payoutService.setStatus(id, body.status);
  }
}

