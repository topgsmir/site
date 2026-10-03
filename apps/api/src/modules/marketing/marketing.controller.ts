import { Body, Controller, Get, Ip, Param, ParseUUIDPipe, Patch, Post, Query, Req, UseGuards } from "@nestjs/common";
import { BrowserSessionMutation } from "../auth/browser-session-mutation.decorator";
import { AuthRateLimitService } from "../auth/auth-rate-limit.service";
import { PlatformAdminGuard, type AuthenticatedRequest } from "../auth/platform-admin.guard";
import { SellerProductsGuard } from "../product/seller-products.guard";
import { CreateMarketingLinkDto, ListMarketingDto, MarketingOptionsDto, MarketingVisitDto, RecordMarketingPayoutDto, UpdateMarketingLinkDto } from "./dto/marketing.dto";
import { MarketingService } from "./marketing.service";

@Controller("marketing")
export class MarketingController {
  constructor(private readonly marketing: MarketingService, private readonly limits: AuthRateLimitService) {}

  @Post("visit")
  async visit(@Body() body: MarketingVisitDto, @Ip() ip: string) {
    await this.limits.consumeMarketingVisit(body.code, ip);
    return this.marketing.visit(body.code);
  }

  @Get("seller")
  @UseGuards(SellerProductsGuard)
  sellerLinks(@Req() request: AuthenticatedRequest, @Query() query: ListMarketingDto) {
    return this.marketing.list(request.sellerContext!.sellerId, query.cursor);
  }

  @Get("seller/options")
  @UseGuards(SellerProductsGuard)
  sellerOptions(@Req() request: AuthenticatedRequest, @Query() query: MarketingOptionsDto) { return this.marketing.options(request.sellerContext!.sellerId, query.search); }

  @Post("seller")
  @BrowserSessionMutation()
  @UseGuards(SellerProductsGuard)
  async sellerCreate(@Req() request: AuthenticatedRequest, @Ip() ip: string, @Body() body: CreateMarketingLinkDto) {
    await this.limits.consumeProductMutation(request.authenticatedUser!.id, ip);
    return this.marketing.create(request.sellerContext!.sellerId, request.authenticatedUser!.id, body, false);
  }

  @Patch("seller/:id")
  @BrowserSessionMutation()
  @UseGuards(SellerProductsGuard)
  async sellerUpdate(@Req() request: AuthenticatedRequest, @Ip() ip: string, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Body() body: UpdateMarketingLinkDto) {
    await this.limits.consumeProductMutation(request.authenticatedUser!.id, ip);
    return this.marketing.update(id, request.sellerContext!.sellerId, request.authenticatedUser!.id, body);
  }

  @Get("admin")
  @UseGuards(PlatformAdminGuard)
  adminLinks(@Query() query: ListMarketingDto) { return this.marketing.list(query.sellerId, query.cursor); }

  @Get("admin/options")
  @UseGuards(PlatformAdminGuard)
  adminOptions(@Query() query: MarketingOptionsDto) { return this.marketing.options(undefined, query.search); }

  @Post("admin")
  @BrowserSessionMutation()
  @UseGuards(PlatformAdminGuard)
  async adminCreate(@Req() request: AuthenticatedRequest, @Ip() ip: string, @Body() body: CreateMarketingLinkDto) {
    await this.limits.consumeProductMutation(request.authenticatedUser!.id, ip);
    return this.marketing.create(body.sellerId, request.authenticatedUser!.id, body, true);
  }

  @Patch("admin/:id")
  @BrowserSessionMutation()
  @UseGuards(PlatformAdminGuard)
  async adminUpdate(@Req() request: AuthenticatedRequest, @Ip() ip: string, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Body() body: UpdateMarketingLinkDto) {
    await this.limits.consumeProductMutation(request.authenticatedUser!.id, ip);
    return this.marketing.update(id, undefined, request.authenticatedUser!.id, body);
  }

  @Get("admin/:id/earnings")
  @UseGuards(PlatformAdminGuard)
  earnings(@Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Query() query: ListMarketingDto) { return this.marketing.earnings(id, query.cursor); }

  @Get("seller/:id/earnings")
  @UseGuards(SellerProductsGuard)
  sellerEarnings(@Req() request: AuthenticatedRequest, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Query() query: ListMarketingDto) { return this.marketing.earnings(id, query.cursor, request.sellerContext!.sellerId); }

  @Get("admin/:id/events")
  @UseGuards(PlatformAdminGuard)
  events(@Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Query() query: ListMarketingDto) { return this.marketing.events(id, query.cursor); }

  @Get("seller/:id/events")
  @UseGuards(SellerProductsGuard)
  sellerEvents(@Req() request: AuthenticatedRequest, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Query() query: ListMarketingDto) { return this.marketing.events(id, query.cursor, request.sellerContext!.sellerId); }

  @Post("admin/earnings/:id/pay")
  @BrowserSessionMutation()
  @UseGuards(PlatformAdminGuard)
  async pay(@Req() request: AuthenticatedRequest, @Ip() ip: string, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Body() body: RecordMarketingPayoutDto) {
    await this.limits.consumeProductMutation(request.authenticatedUser!.id, ip);
    return this.marketing.markPaid(id, request.authenticatedUser!.id, body.reference);
  }
}
