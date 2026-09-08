import { Module } from "@nestjs/common";
import { LocalGatewayAdapter } from "./providers/local-gateway/local-gateway.adapter";
import { PaymentService } from "./payment.service";
import { AuthModule } from "../../modules/auth/auth.module";
import { PaymentApplicationService } from "./payment-application.service";
import { PaymentController } from "./payment.controller";
import { ZarinpalAdapter } from "./providers/zarinpal/zarinpal.adapter";

@Module({
  imports: [AuthModule],
  controllers: [PaymentController],
  providers: [LocalGatewayAdapter, ZarinpalAdapter, PaymentService, PaymentApplicationService],
  exports: [PaymentService]
})
export class PaymentsModule {}

