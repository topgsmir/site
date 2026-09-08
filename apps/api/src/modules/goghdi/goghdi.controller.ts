import { Body, Controller, Header, Post, UseGuards } from "@nestjs/common";
import { AuthenticatedGuard } from "../auth/authenticated.guard";
import { GoghdiProductTicketDto } from "./dto/product-ticket.dto";
import { GoghdiService } from "./goghdi.service";

@Controller("goghdi")
@UseGuards(AuthenticatedGuard)
export class GoghdiController {
  constructor(private readonly goghdi: GoghdiService) {}

  @Post("product-ticket")
  @Header("Cache-Control", "no-store")
  signProductTicket(@Body() body: GoghdiProductTicketDto) {
    // Authentication is deliberately required even though the signed payload
    // itself contains no user data. This route must never be a public HMAC oracle.
    return this.goghdi.signProductTicket(body.productId);
  }
}
