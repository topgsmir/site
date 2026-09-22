import { Module } from "@nestjs/common";
import { CredentialCryptoService } from "../../common/security/credential-crypto.service";
import { AuthModule } from "../auth/auth.module";
import { GoghdiController, GoghdiPublicConfigController, GoghdiSettingsController } from "./goghdi.controller";
import { GoghdiSettingsService } from "./goghdi-settings.service";
import { GoghdiService } from "./goghdi.service";

@Module({
  imports: [AuthModule],
  controllers: [GoghdiController, GoghdiPublicConfigController, GoghdiSettingsController],
  providers: [CredentialCryptoService, GoghdiService, GoghdiSettingsService]
})
export class GoghdiModule {}
