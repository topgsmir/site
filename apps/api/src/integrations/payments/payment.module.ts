import { Module } from "@nestjs/common";
import { LocalGatewayAdapter } from "./providers/local-gateway/local-gateway.adapter";
import { PaymentService } from "./payment.service";

@Module({
  providers: [LocalGatewayAdapter, PaymentService],
  exports: [PaymentService]
})
export class PaymentsModule {}

