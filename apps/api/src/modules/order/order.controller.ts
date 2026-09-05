import { Body, Controller, Get, Patch, Post, Param } from "@nestjs/common";
import { RealtimeGateway } from "../realtime/realtime.gateway";
import { PayoutService } from "../payout/payout.service";
import { OrderStatus } from "@topgsm/shared-types";

type CreateOrderDto = {
  buyerId: string;
  sellerId: string;
  productType: "digital" | "physical" | "service";
  amount: number;
  currency: string;
};

type UpdateOrderStatusDto = {
  status: OrderStatus;
};

type Order = {
  id: string;
  status: OrderStatus;
  items: CreateOrderDto[];
};

const orders: Array<Order> = [];

@Controller("orders")
export class OrderController {
  constructor(
    private readonly realtime: RealtimeGateway,
    private readonly payoutService: PayoutService
  ) {}

  @Get()
  list() {
    return orders;
  }

  @Post()
  create(@Body() body: CreateOrderDto) {
    const order = {
      id: `${Date.now()}`,
      status: "pending" as const,
      items: [body]
    } satisfies Order;

    orders.push(order);
    this.payoutService.recordDraft(order.id, body.sellerId, body.amount, body.currency);
    this.realtime.emitOrderCreated(order.id, {
      orderId: order.id,
      status: order.status
    });
    return order;
  }

  @Patch(":id/status")
  updateStatus(
    @Param("id") id: string,
    @Body() body: UpdateOrderStatusDto
  ) {
    const order = orders.find((item) => item.id === id);
    if (!order) {
      return { message: "order not found" };
    }

    order.status = body.status;
    this.payoutService.updateFromOrderStatus(id, body.status);
    this.realtime.emitOrderStatusChanged(id, {
      orderId: id,
      status: body.status
    });

    return order;
  }
}
