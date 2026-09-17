import {
  Body,
  Controller,
  Get,
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
import { AuthRateLimitService } from "../auth/auth-rate-limit.service";
import { IdempotencyKey } from "../auth/idempotency-key.decorator";
import type { AuthenticatedRequest } from "../auth/platform-admin.guard";
import {
  CreateOrderDto,
  ListOrdersQueryDto,
  UpdateOrderShippingDto,
  UpdateOrderStatusDto
} from "./dto/order.dto";
import { OrderService } from "./order.service";
import { AmadastShippingService } from "../../integrations/shipping/amadast/amadast-shipping.service";

@Controller("orders")
@UseGuards(AuthenticatedGuard)
export class OrderController {
  constructor(
    private readonly orders: OrderService,
    private readonly rateLimits: AuthRateLimitService,
    private readonly amadastShipping: AmadastShippingService
  ) {}

  @Get()
  list(@Req() request: AuthenticatedRequest, @Query() query: ListOrdersQueryDto) {
    return this.orders.list(request.authenticatedUser!, query);
  }

  @Get(":id")
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

  @Post(":id/shipping/amadast")
  async registerAmadastShipping(
    @Req() request: AuthenticatedRequest,
    @Ip() clientIp: string,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @IdempotencyKey() idempotencyKey: string
  ) {
    await this.rateLimits.consumeShippingMutation(request.authenticatedUser!.id, clientIp);
    return this.amadastShipping.register(request.authenticatedUser!, id, idempotencyKey);
  }

  @Post(":id/shipping/amadast/sync")
  async syncAmadastShipping(
    @Req() request: AuthenticatedRequest,
    @Ip() clientIp: string,
    @Param("id", new ParseUUIDPipe({ version: "4" })) id: string,
    @IdempotencyKey() idempotencyKey: string
  ) {
    await this.rateLimits.consumeShippingMutation(request.authenticatedUser!.id, clientIp);
    return this.amadastShipping.sync(request.authenticatedUser!, id, idempotencyKey);
  }

  @Get(":orderId/items/:itemId/download")
  async download(
    @Req() request: AuthenticatedRequest,
    @Param("orderId", new ParseUUIDPipe({ version: "4" })) orderId: string,
    @Param("itemId", new ParseUUIDPipe({ version: "4" })) itemId: string,
    @Res() response: { redirect(url: string): void }
  ) {
    const url = await this.orders.claimDigitalDownload(request.authenticatedUser!, orderId, itemId);
    response.redirect(url);
  }
}
