import { Module } from "@nestjs/common";
import { PaymentsModule } from "../../integrations/payments/payment.module";
import { AuthModule } from "../auth/auth.module";
import { UsdRateModule } from "../usd-rate/usd-rate.module";
import { CheckoutController } from "./checkout.controller";
import { CheckoutService } from "./checkout.service";
import { CheckoutExpiryService } from "./checkout-expiry.service";
import { CredentialCryptoService } from "../../common/security/credential-crypto.service";
import { ShippingModule } from "../../integrations/shipping/shipping.module";

@Module({
  imports: [AuthModule, PaymentsModule, ShippingModule, UsdRateModule],
  controllers: [CheckoutController],
  providers: [CheckoutService, CheckoutExpiryService, CredentialCryptoService]
})
export class CheckoutModule {}
