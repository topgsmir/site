import { Module } from "@nestjs/common";
import { PublicUrlService } from "../../common/http/public-url.service";
import { SafeHttpService } from "../../common/http/safe-http.service";
import { CredentialCryptoService } from "../../common/security/credential-crypto.service";
import { AuthModule } from "../../modules/auth/auth.module";
import { AmadastAdapter } from "./amadast/amadast.adapter";
import { AmadastShippingService } from "./amadast/amadast-shipping.service";
import { AmadastSettingsService } from "./amadast/amadast-settings.service";
import { ShippingSettingsController } from "./shipping-settings.controller";

@Module({
  imports: [AuthModule],
  controllers: [ShippingSettingsController],
  providers: [PublicUrlService, SafeHttpService, CredentialCryptoService, AmadastAdapter, AmadastSettingsService, AmadastShippingService],
  exports: [AmadastSettingsService, AmadastShippingService]
})
export class ShippingModule {}
