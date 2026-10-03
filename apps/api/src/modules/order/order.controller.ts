import {
  Body,
  Controller,
  Get,
  Header,
  HttpCode,
  Ip,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards
} from "@nestjs/common";
import { AuthenticatedGuard } from "../auth/authenticated.guard";
import { DigitalDownloadQueryDto } from "./dto/digital-download.dto";
import { AuthRateLimitService } from "../auth/auth-rate-limit.service";
import { BrowserSessionMutation } from "../auth/browser-session-mutation.decorator";
import { IdempotencyKey } from "../auth/idempotency-key.decorator";
import type { AuthenticatedRequest } from "../auth/platform-admin.guard";
import {
  CreateOrderDto,
  ExportOrdersDto,
  ListOrdersQueryDto,
  SetOrderTrashDto,
  UpdateOrderShippingDto,
  UpdatePurchaseStatusDto,
  UpdateOrderStatusDto
} from "./dto/order.dto";
import { OrderService } from "./order.service";
import { AdminOrderDetailsService } from "./admin-order-details.service";
import { LeaderboardService } from "./leaderboard.service";
import { ShippingService } from "../../integrations/shipping/shipping.service";

@Controller("orders")
@UseGuards(AuthenticatedGuard)
export class OrderController {
  constructor(
    private readonly orders: OrderService,
    private readonly adminDetails: AdminOrderDetailsService,
    private readonly leaderboard: LeaderboardService,
    private readonly rateLimits: AuthRateLimitService,
    private readonly shipping: ShippingService
  ) {}

  @Get()
  @Header("Cache-Control", "private, no-store")
  list(@Req() request: AuthenticatedRequest, @Query() query: ListOrdersQueryDto) {
    return this.orders.list(request.authenticatedUser!, query);
  }

  @Post("export")
  @BrowserSessionMutation()
  @HttpCode(200)
  @Header("Cache-Control", "private, no-store")
  async exportOrders(
    @Req() request: AuthenticatedRequest,
    @Ip() clientIp: string,
    @Body() body: ExportOrdersDto,
    @Res() response: { setHeader(name: string, value: string): void; send(body: string): void }
  ) {
    await this.rateLimits.consumeAnalyticsRead(request.authenticatedUser!.id, clientIp);
    const csv = await this.orders.exportCsv(request.authenticatedUser!, body);
    response.setHeader("Content-Type", "text/csv; charset=utf-8");
    response.setHeader("Content-Disposition", `attachment; filename="orders-${new Date().toISOString().slice(0, 10)}.csv"`);
    response.send(csv);
  }

  @Get("new-count")
  @Header("Cache-Control", "private, no-store")
  newOrderCount(@Req() request: AuthenticatedRequest) {
    return this.orders.newOrderCount(request.authenticatedUser!);
  }

  @Post("seen")
  @HttpCode(200)
  @Header("Cache-Control", "private, no-store")
  markOrdersSeen(@Req() request: AuthenticatedRequest) {
    return this.orders.markOrdersSeen(request.authenticatedUser!);
  }

  @Get("leaderboard")
  async getLeaderboard(@Req() request: AuthenticatedRequest, @Ip() clientIp: string) {
    await this.rateLimits.consumeAnalyticsRead(request.authenticatedUser!.id, clientIp);
    return this.leaderboard.get(request.authenticatedUser!);
  }

  @Get("purchases")
  @Header("Cache-Control", "private, no-store")
  listPurchases(@Req() request: AuthenticatedRequest, @Query() query: ListOrdersQueryDto) {
    return this.orders.listPurchases(request.authenticatedUser!, query);
  }

  @Get("purchases/:id")
  @Header("Cache-Control", "private, no-store")
  getPurchase(@Req() request: AuthenticatedRequest, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string) {
    return this.orders.getPurchase(request.authenticatedUser!, id);
  }

  @Patch("purchases/:id/status")
  async updatePurchaseStatus(
    @Req() request: AuthenticatedRequest,
    @Ip() clientIp: string,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() body: UpdatePurchaseStatusDto,
    @IdempotencyKey() idempotencyKey: string
  ) {
    await this.rateLimits.consumeOrderMutation(request.authenticatedUser!.id, clientIp);
    return this.orders.transitionPurchase(request.authenticatedUser!, id, body, idempotencyKey);
  }

  @Get(":id")
  @Header("Cache-Control", "private, no-store")
  get(@Req() request: AuthenticatedRequest, @Param("id", new ParseUUIDPipe({ version: "4" })) id: string) {
    return this.orders.get(request.authenticatedUser!, id);
  }

  @Post()
  async create(
    @Req() request: AuthenticatedRequest,
    @Ip() clientIp: string,
    @Body() body: CreateOrderDto,
    @IdempotencyKey() idempotencyKey: string
  ) {
    await this.rateLimits.consumeOrderMutation(
      request.authenticatedUser!.id,
      clientIp
    );
    return this.orders.create(request.authenticatedUser!, body, idempotencyKey);
  }

  @Patch(":id/status")
  async updateStatus(
    @Req() request: AuthenticatedRequest,
    @Ip() clientIp: string,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() body: UpdateOrderStatusDto,
    @IdempotencyKey() idempotencyKey: string
  ) {
    await this.rateLimits.consumeOrderMutation(
      request.authenticatedUser!.id,
      clientIp
    );
    return this.orders.transition(
      request.authenticatedUser!,
      id,
      body,
      idempotencyKey
    );
  }

  @Get("admin/:id")
  @Header("Cache-Control", "private, no-store")
  async getAdminDetails(
    @Req() request: AuthenticatedRequest,
    @Ip() clientIp: string,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string
  ) {
    await this.rateLimits.consumeAnalyticsRead(request.authenticatedUser!.id, clientIp);
    return this.adminDetails.get(request.authenticatedUser!, id);
  }

  @Patch("admin/:id/trash")
  async setTrash(
    @Req() request: AuthenticatedRequest,
    @Ip() clientIp: string,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() body: SetOrderTrashDto,
    @IdempotencyKey() idempotencyKey: string
  ) {
    await this.rateLimits.consumeOrderMutation(request.authenticatedUser!.id, clientIp);
    return this.orders.setTrash(request.authenticatedUser!, id, body, idempotencyKey);
  }

  @Patch(":id/shipping")
  async updateShipping(
    @Req() request: AuthenticatedRequest,
    @Ip() clientIp: string,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @Body() body: UpdateOrderShippingDto,
    @IdempotencyKey() idempotencyKey: string
  ) {
    await this.rateLimits.consumeOrderMutation(request.authenticatedUser!.id, clientIp);
    return this.orders.ship(request.authenticatedUser!, id, body, idempotencyKey);
  }

  @Post([":id/shipping/register", ":id/shipping/amadast"])
  async registerProviderShipping(
    @Req() request: AuthenticatedRequest,
    @Ip() clientIp: string,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @IdempotencyKey() idempotencyKey: string
  ) {
    await this.rateLimits.consumeShippingMutation(request.authenticatedUser!.id, clientIp);
    return this.shipping.register(request.authenticatedUser!, id, idempotencyKey);
  }

  @Post([":id/shipping/sync", ":id/shipping/amadast/sync"])
  async syncProviderShipping(
    @Req() request: AuthenticatedRequest,
    @Ip() clientIp: string,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @IdempotencyKey() idempotencyKey: string
  ) {
    await this.rateLimits.consumeShippingMutation(request.authenticatedUser!.id, clientIp);
    return this.shipping.sync(request.authenticatedUser!, id, idempotencyKey);
  }

  @Post(":orderId/items/:itemId/download")
  async download(
    @Query() query: DigitalDownloadQueryDto,
    @Req() request: AuthenticatedRequest,
    @Ip() clientIp: string,
    @Param("orderId", new ParseUUIDPipe({ version: "4" })) orderId: string,
    @Param("itemId", new ParseUUIDPipe({ version: "4" })) itemId: string
  ) {
    await this.rateLimits.consumeDigitalDownload(request.authenticatedUser!.id, clientIp);
    const url = await this.orders.claimDigitalDownload(request.authenticatedUser!, orderId, itemId, clientIp, query.fileIndex);
    return { url };
  }
}
