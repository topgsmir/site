import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module";
import { AlanChandRateProvider } from "./alan-chand-rate.provider";
import { NobitexRateProvider } from "./nobitex-rate.provider";
import { TgjuRateProvider } from "./tgju-rate.provider";
import { UsdRateCronService } from "./usd-rate-cron.service";
import { UsdRateController } from "./usd-rate.controller";
import { UsdRateProviderRegistry } from "./usd-rate-provider.registry";
import { UsdRateService } from "./usd-rate.service";

@Module({
  imports: [AuthModule],
  controllers: [UsdRateController],
  providers: [AlanChandRateProvider, NobitexRateProvider, TgjuRateProvider, UsdRateProviderRegistry, UsdRateCronService, UsdRateService],
  exports: [UsdRateService]
})
export class UsdRateModule {}
