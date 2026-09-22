import assert from "node:assert/strict";
import type { AddressInfo } from "node:net";
import { test } from "node:test";
import { Test } from "@nestjs/testing";
import { AuthenticatedGuard } from "../auth/authenticated.guard";
import { AuthRateLimitService } from "../auth/auth-rate-limit.service";
import { AmadastShippingService } from "../../integrations/shipping/amadast/amadast-shipping.service";
import { AdminOrderDetailsService } from "./admin-order-details.service";
import { LeaderboardService } from "./leaderboard.service";
import { OrderController } from "./order.controller";
import { OrderService } from "./order.service";

test("GET /orders/leaderboard reaches the leaderboard route before /orders/:id", async () => {
  const module = await Test.createTestingModule({
    controllers: [OrderController],
    providers: [
      { provide: OrderService, useValue: { get: () => { throw new Error("order route matched"); } } },
      { provide: AdminOrderDetailsService, useValue: {} },
      { provide: LeaderboardService, useValue: { get: () => ({ leaders: [], you: { place: null } }) } },
      { provide: AuthRateLimitService, useValue: { consumeAnalyticsRead: async () => undefined } },
      { provide: AmadastShippingService, useValue: {} }
    ]
  }).overrideGuard(AuthenticatedGuard).useValue({
    canActivate: (context: { switchToHttp(): { getRequest(): { authenticatedUser?: { id: string; role: string } } } }) => {
      context.switchToHttp().getRequest().authenticatedUser = { id: "buyer-1", role: "buyer" };
      return true;
    }
  }).compile();
  const app = module.createNestApplication();
  try {
    await app.listen(0, "127.0.0.1");
    const port = (app.getHttpServer().address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/orders/leaderboard`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { leaders: [], you: { place: null } });
  } finally {
    await app.close();
  }
});

test("GET /orders/new-count reaches the count route before /orders/:id", async () => {
  const module = await Test.createTestingModule({
    controllers: [OrderController],
    providers: [
      { provide: OrderService, useValue: { newOrderCount: () => ({ count: 3 }), get: () => { throw new Error("order route matched"); } } },
      { provide: AdminOrderDetailsService, useValue: {} },
      { provide: LeaderboardService, useValue: {} },
      { provide: AuthRateLimitService, useValue: {} },
      { provide: AmadastShippingService, useValue: {} }
    ]
  }).overrideGuard(AuthenticatedGuard).useValue({
    canActivate: (context: { switchToHttp(): { getRequest(): { authenticatedUser?: { id: string; role: string } } } }) => {
      context.switchToHttp().getRequest().authenticatedUser = { id: "admin-1", role: "platform-admin" };
      return true;
    }
  }).compile();
  const app = module.createNestApplication();
  try {
    await app.listen(0, "127.0.0.1");
    const port = (app.getHttpServer().address() as AddressInfo).port;
    const response = await fetch(`http://127.0.0.1:${port}/orders/new-count`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { count: 3 });
  } finally {
    await app.close();
  }
});
