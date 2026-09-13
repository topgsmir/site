import { Body, Controller, Header, Ip, Post, Req, UseGuards } from "@nestjs/common";
import { AuthenticatedGuard } from "../auth/authenticated.guard";
import { AuthRateLimitService } from "../auth/auth-rate-limit.service";
import type { AuthenticatedRequest } from "../auth/platform-admin.guard";
import { GoghdiProductTicketDto } from "./dto/product-ticket.dto";
import { GoghdiService } from "./goghdi.service";

@Controller("goghdi")
@UseGuards(AuthenticatedGuard)
export class GoghdiController {
  constructor(
    private readonly goghdi: GoghdiService,
    private readonly rateLimits: AuthRateLimitService
  ) {}

  @Post("product-ticket")
  @Header("Cache-Control", "no-store")
  async signProductTicket(
    @Body() body: GoghdiProductTicketDto,
    @Req() request: AuthenticatedRequest,
    @Ip() clientIp: string
  ) {
    // Authentication is deliberately required even though the signed payload
    // itself contains no user data. This route must never be a public HMAC oracle.
    await this.rateLimits.consumeSignedTicket(request.authenticatedUser!.id, clientIp);
    return this.goghdi.signProductTicket(body.productId);
  }
}
