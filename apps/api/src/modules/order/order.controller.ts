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
  UseGuards
} from "@nestjs/common";
import { AuthenticatedGuard } from "../auth/authenticated.guard";
import { AuthRateLimitService } from "../auth/auth-rate-limit.service";
import { IdempotencyKey } from "../auth/idempotency-key.decorator";
import type { AuthenticatedRequest } from "../auth/platform-admin.guard";
import {
  CreateOrderDto,
  ListOrdersQueryDto,
  UpdateOrderStatusDto
} from "./dto/order.dto";
import { OrderService } from "./order.service";

@Controller("orders")
@UseGuards(AuthenticatedGuard)
export class OrderController {
  constructor(
    private readonly orders: OrderService,
    private readonly rateLimits: AuthRateLimitService
  ) {}

  @Get()
  list(@Req() request: AuthenticatedRequest, @Query() query: ListOrdersQueryDto) {
    return this.orders.list(request.authenticatedUser!, query);
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
}
