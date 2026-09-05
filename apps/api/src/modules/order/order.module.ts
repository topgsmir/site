import { Module } from "@nestjs/common";
import { OrderController } from "./order.controller";
import { PayoutModule } from "../payout/payout.module";
import { RealtimeModule } from "../realtime/realtime.module";

@Module({
  imports: [PayoutModule, RealtimeModule],
  controllers: [OrderController]
})
export class OrderModule {}

