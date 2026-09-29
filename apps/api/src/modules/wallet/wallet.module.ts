import { Module } from "@nestjs/common";
import { PaymentsModule } from "../../integrations/payments/payment.module";
import { AuthModule } from "../auth/auth.module";
import { WalletCoreModule } from "./wallet-core.module";
import { WalletController } from "./wallet.controller";
import { WalletService } from "./wallet.service";

@Module({ imports: [AuthModule, PaymentsModule, WalletCoreModule], controllers: [WalletController], providers: [WalletService] })
export class WalletModule {}
