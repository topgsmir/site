import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Post, Req, UseGuards } from "@nestjs/common";
import { AuthenticatedGuard } from "../auth/authenticated.guard";
import type { AuthenticatedRequest } from "../auth/platform-admin.guard";
import { PlatformAdminGuard } from "../auth/platform-admin.guard";
import { BridgeService } from "./bridge.service";
import { BridgeFeatureGuard } from "./bridge-feature.guard";
import { BridgeFulfillmentService } from "./bridge-fulfillment.service";
import { SellerBridgeGuard } from "./seller-bridge.guard";
import { CompleteBridgeOrderDto, CreateBridgeConnectionDto, GrantBridgeServiceDto, RequestBridgeRefundDto, RevokeBridgeGrantDto, RotateBridgeConnectionDto } from "./dto/bridge.dto";

@Controller("bridge")
@UseGuards(BridgeFeatureGuard)
export class BridgeController {
  constructor(private readonly bridge: BridgeService, private readonly fulfillments: BridgeFulfillmentService) {}

  @Get("connections") @UseGuards(SellerBridgeGuard)
  listConnections(@Req() request: AuthenticatedRequest) {
    return this.bridge.listConnections(request.sellerContext!.sellerId);
  }

  @Post("connections") @UseGuards(SellerBridgeGuard)
  createConnection(@Req() request: AuthenticatedRequest, @Body() body: CreateBridgeConnectionDto) {
    return this.bridge.createConnection(request.sellerContext!.sellerId, request.sellerContext!.membershipRole, body);
  }

  @Patch("connections/:id") @UseGuards(SellerBridgeGuard)
  rotateConnection(@Req() request: AuthenticatedRequest, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Body() body: RotateBridgeConnectionDto) {
    return this.bridge.rotateConnection(request.sellerContext!.sellerId, request.sellerContext!.membershipRole, id, body);
  }

  @Post("connections/:id/test") @UseGuards(SellerBridgeGuard)
  testConnection(@Req() request: AuthenticatedRequest, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string) {
    return this.bridge.testConnection(request.sellerContext!.sellerId, request.sellerContext!.membershipRole, id);
  }

  @Post("connections/:id/synchronize") @UseGuards(SellerBridgeGuard)
  synchronize(@Req() request: AuthenticatedRequest, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string) {
    return this.bridge.synchronize(request.sellerContext!.sellerId, request.sellerContext!.membershipRole, id);
  }

  @Delete("connections/:id") @UseGuards(SellerBridgeGuard)
  deactivate(@Req() request: AuthenticatedRequest, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string) {
    return this.bridge.deactivate(request.sellerContext!.sellerId, request.sellerContext!.membershipRole, id);
  }

  @Get("services") @UseGuards(SellerBridgeGuard)
  services(@Req() request: AuthenticatedRequest) { return this.bridge.listServices(request.sellerContext!.sellerId); }

  @Get("grants") @UseGuards(SellerBridgeGuard)
  grants(@Req() request: AuthenticatedRequest) { return this.bridge.listGrants(request.sellerContext!.sellerId); }

  @Get("admin/connections") @UseGuards(PlatformAdminGuard)
  adminConnections() { return this.bridge.listAdmin(); }

  @Get("admin/services") @UseGuards(PlatformAdminGuard)
  adminServices() { return this.bridge.listAdminServices(); }

  @Post("products/:productId/accept-schema") @UseGuards(SellerBridgeGuard)
  acceptSchema(
    @Req() request: AuthenticatedRequest,
    @Param("productId", new ParseUUIDPipe({ version: "4" })) productId: string
  ) {
    return this.bridge.acceptProductSchema(request.sellerContext!.sellerId, productId);
  }

  @Post("admin/grants") @UseGuards(PlatformAdminGuard)
  grant(@Req() request: AuthenticatedRequest, @Body() body: GrantBridgeServiceDto) {
    return this.bridge.activateGrant(body.serviceId, request.authenticatedUser!.id);
  }

  @Post("admin/grants/:id/revoke") @UseGuards(PlatformAdminGuard)
  revoke(@Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Body() body: RevokeBridgeGrantDto) {
    return this.bridge.revokeGrant(id, body.productAction);
  }

  @Get("orders") @UseGuards(SellerBridgeGuard)
  sellerOrders(@Req() request: AuthenticatedRequest) {
    return this.fulfillments.listSeller(request.sellerContext!.sellerId, request.authenticatedUser!.id);
  }

  @Post("orders/:id/complete") @UseGuards(SellerBridgeGuard)
  completeOrder(@Req() request: AuthenticatedRequest, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Body() body: CompleteBridgeOrderDto) {
    return this.fulfillments.completeManual(request.sellerContext!.sellerId, request.authenticatedUser!.id, id, body.result);
  }

  @Post("orders/:id/retry") @UseGuards(SellerBridgeGuard)
  retryOrder(@Req() request: AuthenticatedRequest, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string) {
    return this.fulfillments.retry(request.sellerContext!.sellerId, request.authenticatedUser!.id, id);
  }

  @Post("orders/:id/refund-request") @UseGuards(AuthenticatedGuard)
  requestRefund(@Req() request: AuthenticatedRequest, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string, @Body() body: RequestBridgeRefundDto) {
    return this.fulfillments.requestRefund(request.authenticatedUser!.id, id, body.reason);
  }

  @Get("admin/refund-requests") @UseGuards(PlatformAdminGuard)
  refundRequests() { return this.fulfillments.listRefundRequests(); }
}
