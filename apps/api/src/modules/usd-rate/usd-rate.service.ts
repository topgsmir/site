import { BadRequestException, Injectable, ServiceUnavailableException } from "@nestjs/common";
import type { AdminUsdRateSettings } from "@topgsm/shared-types";
import { Prisma } from "../../prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import type { UpdateUsdRateSettingsDto } from "./dto/usd-rate-settings.dto";
import { UsdRateProviderRegistry } from "./usd-rate-provider.registry";

const SETTINGS_ID = 1;
export const USD_RATE_INTERVAL_MS = 3 * 60 * 60 * 1000;

const settingsSelect = {
  automation_enabled: true,
  selected_provider: true,
  rate_toman: true,
  rate_source: true,
  rate_updated_at: true,
  last_run_status: true,
  last_attempt_at: true,
  last_success_at: true,
  last_failure_at: true,
  last_error_code: true,
  next_run_at: true,
  updated_at: true
} satisfies Prisma.usd_exchange_rate_settingsSelect;

type RateDb = PrismaService | Prisma.TransactionClient;
type SettingsRecord = Prisma.usd_exchange_rate_settingsGetPayload<{ select: typeof settingsSelect }>;

@Injectable()
export class UsdRateService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly providers?: UsdRateProviderRegistry
  ) {}

  async getAdminSettings(): Promise<AdminUsdRateSettings> {
    const settings = await this.prisma.usd_exchange_rate_settings.findUniqueOrThrow({
      where: { id: SETTINGS_ID },
      select: settingsSelect
    });
    const providers = this.requireProviders();
    return this.map(settings, await providers.getQuotes());
  }

  async getIrrPerUsd(db: RateDb = this.prisma) {
    const settings = await db.usd_exchange_rate_settings.findUnique({
      where: { id: SETTINGS_ID },
      select: { rate_toman: true }
    });
    if (!settings?.rate_toman) {
      throw new ServiceUnavailableException({
        code: "USD_RATE_UNAVAILABLE",
        message: "The USD exchange rate is not configured"
      });
    }
    return settings.rate_toman.mul(10);
  }

  async update(input: UpdateUsdRateSettingsDto, actorUserId: string): Promise<AdminUsdRateSettings> {
    const manualRate = input.manualRateToman === undefined ? null : new Prisma.Decimal(input.manualRateToman);
    if (manualRate && (manualRate.lt(10_000) || manualRate.gt(10_000_000))) {
      throw new BadRequestException("The USD sell price must be between 10,000 and 10,000,000 toman");
    }

    const settings = await this.prisma.$transaction(async (transaction) => {
      const current = await transaction.usd_exchange_rate_settings.findUniqueOrThrow({
        where: { id: SETTINGS_ID },
        select: { automation_enabled: true, selected_provider: true, last_run_status: true }
      });
      const automationEnabled = input.automationEnabled ?? current.automation_enabled;
      const selectedProvider = input.provider ?? current.selected_provider;
      const providerChanged = selectedProvider !== current.selected_provider;
      const updated = await transaction.usd_exchange_rate_settings.update({
        where: { id: SETTINGS_ID },
        data: {
          ...(input.automationEnabled === undefined ? {} : {
            automation_enabled: automationEnabled,
            next_run_at: automationEnabled ? new Date() : null
          }),
          ...(input.provider === undefined ? {} : {
            selected_provider: selectedProvider,
            ...(automationEnabled ? { next_run_at: new Date() } : {})
          }),
          ...(manualRate ? {
            rate_toman: manualRate,
            rate_source: "manual",
            rate_updated_at: new Date()
          } : {}),
          ...(current.last_run_status === "running" ? { last_run_status: "cancelled" } : {}),
          run_token: null
        },
        select: settingsSelect
      });

      await transaction.usd_exchange_rate_events.create({
        data: {
          settings_id: SETTINGS_ID,
          actor_user_id: actorUserId,
          event_type: manualRate ? "manual_override" : providerChanged ? "provider_changed" : "automation_changed",
          selected_provider: selectedProvider,
          rate_toman: manualRate,
          automation_enabled: automationEnabled
        }
      });
      return updated;
    });
    const providers = this.requireProviders();
    return this.map(settings, await providers.getQuotes());
  }

  private map(settings: SettingsRecord, providers: AdminUsdRateSettings["providers"]): AdminUsdRateSettings {
    const rateToman = settings.rate_toman?.toString() ?? null;
    const selectedProvider = settings.selected_provider as AdminUsdRateSettings["selectedProvider"];
    return {
      automationEnabled: settings.automation_enabled,
      selectedProvider,
      providers,
      currentRateToman: rateToman,
      currentRateIrr: settings.rate_toman?.mul(10).toString() ?? null,
      rateSource: settings.rate_source as AdminUsdRateSettings["rateSource"],
      rateUpdatedAt: settings.rate_updated_at?.toISOString() ?? null,
      cronStatus: settings.last_run_status as AdminUsdRateSettings["cronStatus"],
      lastAttemptAt: settings.last_attempt_at?.toISOString() ?? null,
      lastSuccessAt: settings.last_success_at?.toISOString() ?? null,
      lastFailureAt: settings.last_failure_at?.toISOString() ?? null,
      lastErrorCode: settings.last_error_code,
      nextRunAt: settings.next_run_at?.toISOString() ?? null,
      updatedAt: settings.updated_at.toISOString(),
      sourceUrl: this.requireProviders().getSourceUrl(selectedProvider),
      intervalHours: USD_RATE_INTERVAL_MS / (60 * 60 * 1000)
    };
  }

  private requireProviders() {
    if (!this.providers) throw new ServiceUnavailableException("USD rate providers are unavailable");
    return this.providers;
  }
}
