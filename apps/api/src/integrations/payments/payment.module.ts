import { Module } from "@nestjs/common";
import { LocalGatewayAdapter } from "./providers/local-gateway/local-gateway.adapter";
import { PAYMENT_ADAPTERS, PaymentService } from "./payment.service";
import { AuthModule } from "../../modules/auth/auth.module";
import { PaymentApplicationService } from "./payment-application.service";
import { PaymentController } from "./payment.controller";
import { ZarinpalAdapter } from "./providers/zarinpal/zarinpal.adapter";
import { ZibalAdapter } from "./providers/zibal/zibal.adapter";
import { CredentialCryptoService } from "../../common/security/credential-crypto.service";
import { PaymentCredentialService } from "./payment-credential.service";
import { WalletCoreModule } from "../../modules/wallet/wallet-core.module";

@Module({
  imports: [AuthModule, WalletCoreModule],
  controllers: [PaymentController],
  providers: [CredentialCryptoService, PaymentCredentialService, LocalGatewayAdapter, ZarinpalAdapter, ZibalAdapter, {
    provide: PAYMENT_ADAPTERS,
    useFactory: (local: LocalGatewayAdapter, zarinpal: ZarinpalAdapter, zibal: ZibalAdapter) => [local, zarinpal, zibal],
    inject: [LocalGatewayAdapter, ZarinpalAdapter, ZibalAdapter]
  }, PaymentService, PaymentApplicationService],
  exports: [PaymentService, PaymentApplicationService]
})
export class PaymentsModule {}

