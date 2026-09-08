import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { BridgeModule } from "../bridge/bridge.module";
import { OrderController } from "./order.controller";
import { OrderService } from "./order.service";

@Module({
  imports: [AuthModule, BridgeModule],
  controllers: [OrderController],
  providers: [OrderService]
})
export class OrderModule {}
