import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { BridgeModule } from "../bridge/bridge.module";
import { UsdRateModule } from "../usd-rate/usd-rate.module";
import { ShippingModule } from "../../integrations/shipping/shipping.module";
import { OrderController } from "./order.controller";
import { OrderService } from "./order.service";
import { LeaderboardService } from "./leaderboard.service";
import { AdminOrderDetailsService } from "./admin-order-details.service";
import { SellerCustomersController } from "./seller-customers.controller";
import { SellerCustomersService } from "./seller-customers.service";

@Module({
  imports: [AuthModule, BridgeModule, UsdRateModule, ShippingModule],
  controllers: [OrderController, SellerCustomersController],
  providers: [OrderService, LeaderboardService, AdminOrderDetailsService, SellerCustomersService]
})
export class OrderModule {}
