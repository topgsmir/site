import { Module } from "@nestjs/common";
import { PaymentsModule } from "../../integrations/payments/payment.module";
import { AuthModule } from "../auth/auth.module";
import { UsdRateModule } from "../usd-rate/usd-rate.module";
import { CheckoutController } from "./checkout.controller";
import { CheckoutService } from "./checkout.service";
import { CheckoutExpiryService } from "./checkout-expiry.service";
import { CredentialCryptoService } from "../../common/security/credential-crypto.service";
import { ShippingModule } from "../../integrations/shipping/shipping.module";
import { WalletCoreModule } from "../wallet/wallet-core.module";
import { ClubCoreModule } from "../club/club-core.module";

@Module({
  imports: [AuthModule, PaymentsModule, ShippingModule, UsdRateModule, WalletCoreModule, ClubCoreModule],
  controllers: [CheckoutController],
  providers: [CheckoutService, CheckoutExpiryService, CredentialCryptoService]
})
export class CheckoutModule {}
