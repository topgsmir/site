import { Module } from "@nestjs/common";
import { PublicUrlService } from "../../common/http/public-url.service";
import { SafeHttpService } from "../../common/http/safe-http.service";
import { CredentialCryptoService } from "../../common/security/credential-crypto.service";
import { AuthModule } from "../../modules/auth/auth.module";
import { AmadastAdapter } from "./amadast/amadast.adapter";
import { AmadastShippingProvider } from "./amadast/amadast-shipping.provider";
import { AmadastSettingsService } from "./amadast/amadast-settings.service";
import { ShippingSettingsController } from "./shipping-settings.controller";
import { ShippingProviderRegistry } from "./shipping-provider.registry";
import { ShippingService } from "./shipping.service";
import { ShippingTenantService } from "./shipping-tenant.service";
import { SellerShippingProfileController } from "./seller-shipping-profile.controller";
import { SellerShippingProfileService } from "./seller-shipping-profile.service";

@Module({
  imports: [AuthModule],
  controllers: [ShippingSettingsController, SellerShippingProfileController],
  providers: [
    PublicUrlService,
    SafeHttpService,
    CredentialCryptoService,
    AmadastAdapter,
    AmadastSettingsService,
    AmadastShippingProvider,
    ShippingProviderRegistry,
    ShippingTenantService,
    SellerShippingProfileService,
    ShippingService
  ],
  exports: [ShippingProviderRegistry, ShippingTenantService, SellerShippingProfileService, ShippingService]
})
export class ShippingModule {}
