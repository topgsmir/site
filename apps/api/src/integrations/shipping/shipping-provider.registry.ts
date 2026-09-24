import { Injectable, ServiceUnavailableException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { AmadastShippingProvider } from "./amadast/amadast-shipping.provider";
import type { ShippingProvider } from "./shipping-provider";

@Injectable()
export class ShippingProviderRegistry {
  constructor(
    private readonly config: ConfigService,
    private readonly amadast: AmadastShippingProvider
  ) {}

  active(): ShippingProvider {
    const code = this.config.get<string>("SHIPPING_PROVIDER")?.trim().toLowerCase() || "amadast";
    return this.get(code);
  }

  get(code: string): ShippingProvider {
    if (code === this.amadast.code) return this.amadast;
    throw new ServiceUnavailableException("The configured shipping provider is not supported");
  }
}
