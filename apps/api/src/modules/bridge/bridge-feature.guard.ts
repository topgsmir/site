import { CanActivate, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

@Injectable()
export class BridgeFeatureGuard implements CanActivate {
  constructor(private readonly config: ConfigService) {}
  canActivate() {
    if (this.config.get<string>("BRIDGE_FEATURE_ENABLED") !== "true") throw new ServiceUnavailableException("Bridge is not enabled");
    return true;
  }
}
