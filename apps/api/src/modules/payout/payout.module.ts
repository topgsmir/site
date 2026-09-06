import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { PayoutController } from "./payout.controller";
import { PayoutService } from "./payout.service";

@Module({
  imports: [AuthModule],
  controllers: [PayoutController],
  providers: [PayoutService]
})
export class PayoutModule {}
