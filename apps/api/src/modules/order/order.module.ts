import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { BridgeModule } from "../bridge/bridge.module";
import { UsdRateModule } from "../usd-rate/usd-rate.module";
import { ShippingModule } from "../../integrations/shipping/shipping.module";
import { OrderController } from "./order.controller";
import { OrderService } from "./order.service";

@Module({
  imports: [AuthModule, BridgeModule, UsdRateModule, ShippingModule],
  controllers: [OrderController],
  providers: [OrderService]
})
export class OrderModule {}
