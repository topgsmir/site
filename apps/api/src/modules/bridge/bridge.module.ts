import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { BridgeController } from "./bridge.controller";
import { BridgeProviderService } from "./bridge-provider.service";
import { BridgeService } from "./bridge.service";
import { CredentialCryptoService } from "./credential-crypto.service";
import { PublicUrlService } from "./public-url.service";
import { SafeHttpService } from "./safe-http.service";
import { SellerBridgeGuard } from "./seller-bridge.guard";
import { DhruLegacyAdapter } from "./providers/dhru-legacy.adapter";
import { DhruNewAdapter } from "./providers/dhru-new.adapter";
import { WebxAdapter } from "./providers/webx.adapter";
import { WebxAuthKeyService } from "./providers/webx-auth-key.service";
import { BridgeFulfillmentWorkerService } from "./bridge-fulfillment-worker.service";
import { BridgeFulfillmentService } from "./bridge-fulfillment.service";
import { BridgeFeatureGuard } from "./bridge-feature.guard";

@Module({
  imports: [AuthModule],
  controllers: [BridgeController],
  providers: [BridgeService, BridgeProviderService, BridgeFulfillmentService, BridgeFulfillmentWorkerService, BridgeFeatureGuard, CredentialCryptoService, PublicUrlService, SafeHttpService, SellerBridgeGuard, DhruLegacyAdapter, DhruNewAdapter, WebxAuthKeyService, WebxAdapter],
  exports: [BridgeService, BridgeProviderService, CredentialCryptoService]
})
export class BridgeModule {}
