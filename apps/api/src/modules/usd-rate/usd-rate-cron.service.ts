import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import type { UsdRateProviderId } from "@topgsm/shared-types";
import { randomUUID } from "node:crypto";
import { Prisma } from "../../prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { UsdRateFetchError } from "./usd-rate-provider";
import { UsdRateProviderRegistry } from "./usd-rate-provider.registry";
import { USD_RATE_INTERVAL_MS } from "./usd-rate.service";

const SETTINGS_ID = 1;
const POLL_INTERVAL_MS = 60_000;
const STALE_RUN_MS = 15 * 60 * 1000;

export function assertReasonableRateChange(current: Prisma.Decimal | null, next: Prisma.Decimal) {
  if (!current) return;
  if (next.lt(current.mul("0.75")) || next.gt(current.mul("1.25"))) {
    throw new UsdRateFetchError("USD_RATE_CHANGE_TOO_LARGE");
  }
}

@Injectable()
export class UsdRateCronService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(UsdRateCronService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: UsdRateProviderRegistry
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.tick(), POLL_INTERVAL_MS);
    this.timer.unref();
    void this.tick();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async tick() {
    const now = new Date();
    const runToken = randomUUID();
    let providerId: UsdRateProviderId | null = null;
    const claim = await this.prisma.usd_exchange_rate_settings.updateMany({
      where: {
        id: SETTINGS_ID,
        automation_enabled: true,
        next_run_at: { lte: now },
        OR: [
          { run_token: null },
          { last_attempt_at: { lte: new Date(now.getTime() - STALE_RUN_MS) } }
        ]
      },
      data: {
        last_run_status: "running",
        last_attempt_at: now,
        next_run_at: new Date(now.getTime() + USD_RATE_INTERVAL_MS),
        run_token: runToken
      }
    });
    if (claim.count !== 1) return;

    try {
      const claimed = await this.prisma.usd_exchange_rate_settings.findFirst({
        where: { id: SETTINGS_ID, run_token: runToken },
        select: { selected_provider: true }
      });
      if (!claimed) return;
      providerId = claimed.selected_provider as UsdRateProviderId;
      const provider = this.providers.get(providerId);
      const rate = await provider.fetchUsdSellRateToman();
      await this.complete(runToken, provider.id, rate);
    } catch (error) {
      const code = error instanceof UsdRateFetchError ? error.code : "UNEXPECTED_FETCH_ERROR";
      await this.fail(runToken, code, providerId);
      this.logger.warn(`USD rate refresh failed: ${code}`);
    }
  }

  private async complete(runToken: string, provider: UsdRateProviderId, rate: string) {
    const completed = await this.prisma.$transaction(async (transaction) => {
      const current = await transaction.usd_exchange_rate_settings.findUniqueOrThrow({
        where: { id: SETTINGS_ID },
        select: { rate_toman: true }
      });
      assertReasonableRateChange(current.rate_toman, new Prisma.Decimal(rate));
      const completed = await transaction.usd_exchange_rate_settings.updateMany({
        where: { id: SETTINGS_ID, run_token: runToken },
        data: {
          rate_toman: rate,
          rate_source: provider,
          rate_updated_at: new Date(),
          last_run_status: "success",
          last_success_at: new Date(),
          last_error_code: null,
          run_token: null
        }
      });
      if (completed.count !== 1) return false;
      await transaction.usd_exchange_rate_events.create({
        data: {
          settings_id: SETTINGS_ID,
          event_type: "automatic_refresh",
          selected_provider: provider,
          rate_toman: rate,
          automation_enabled: true
        }
      });
      return true;
    });
    if (completed) this.providers.clearQuoteCache();
  }

  private async fail(runToken: string, errorCode: string, provider: UsdRateProviderId | null) {
    await this.prisma.$transaction(async (transaction) => {
      const failed = await transaction.usd_exchange_rate_settings.updateMany({
        where: { id: SETTINGS_ID, run_token: runToken },
        data: {
          last_run_status: "failed",
          last_failure_at: new Date(),
          last_error_code: errorCode,
          run_token: null
        }
      });
      if (failed.count !== 1) return;
      await transaction.usd_exchange_rate_events.create({
        data: {
          settings_id: SETTINGS_ID,
          event_type: "automatic_refresh",
          selected_provider: provider,
          automation_enabled: true,
          error_code: errorCode
        }
      });
    });
  }
}
