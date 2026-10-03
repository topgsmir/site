import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "../../prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { SmsRulesService } from "./sms-rules.service";
import { SmsSettingsService } from "./sms-settings.service";

@Injectable()
export class SmsPendingProductsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SmsPendingProductsService.name);
  private timer?: NodeJS.Timeout;
  private busy = false;
  private lastCleanup = 0;

  constructor(private readonly prisma: PrismaService, private readonly rules: SmsRulesService, private readonly settings: SmsSettingsService, private readonly config: ConfigService) {}

  onModuleInit() {
    if (this.config.get<string>("DISABLE_BACKGROUND_WORKERS") === "true") return;
    this.timer = setInterval(() => void this.tick(), 60_000);
    this.timer.unref();
  }

  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  private async tick() {
    if (this.busy) return;
    this.busy = true;
    try {
      if (Date.now() - this.lastCleanup > 3_600_000) {
        await this.prisma.sms_guest_challenges.deleteMany({ where: { expires_at: { lt: new Date(Date.now() - 7 * 86_400_000) } } });
        this.lastCleanup = Date.now();
      }
      if (!(await this.rules.enabled("pending_product"))) return;
      const minutes = (await this.settings.get()).pendingCheckMinutes;
      const bucket = Math.floor(Date.now() / (minutes * 60_000));
      const pendingCount = await this.prisma.products.count({ where: { status: "pending_review" } });
      if (!pendingCount) return;
      await this.prisma.outbox_events.createMany({ skipDuplicates: true, data: [{
        aggregate: "product", aggregate_id: String(bucket), event_type: "product.pending.alert",
        dedupe_key: `product.pending.alert:${bucket}`, payload: { pendingCount }
      }] });
    } catch (error) {
      this.logger.warn(`Pending product SMS scan failed: ${error instanceof Prisma.PrismaClientKnownRequestError ? error.code : error instanceof Error ? error.constructor.name : "SmsScanError"}`);
    } finally { this.busy = false; }
  }
}
