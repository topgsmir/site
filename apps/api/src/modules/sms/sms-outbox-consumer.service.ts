import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "../../prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { normalizeIranianPhone } from "./phone-number";
import { SmsService, type SmsTemplate } from "./sms.service";

type ClaimedEvent = { event_id: string; event_type: string; payload: Prisma.JsonValue };

@Injectable()
export class SmsOutboxConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SmsOutboxConsumerService.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  constructor(private readonly prisma: PrismaService, private readonly sms: SmsService, private readonly config: ConfigService) {}

  onModuleInit() {
    if (this.config.get<string>("DISABLE_BACKGROUND_WORKERS") === "true") return;
    this.timer = setInterval(() => void this.tick(), 2_000);
    this.timer.unref();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  private async tick() {
    if (this.running) return;
    this.running = true;
    let claimed: ClaimedEvent | undefined;
    try {
      await this.prisma.$executeRaw(Prisma.sql`
        INSERT INTO "outbox_deliveries" ("event_id", "consumer")
        SELECT "id", 'sms' FROM "outbox_events"
        WHERE "event_type" IN ('order.paid', 'bridge.fulfillment.succeeded', 'bridge.fulfillment.failed')
        ON CONFLICT DO NOTHING
      `);
      const rows = await this.prisma.$queryRaw<ClaimedEvent[]>(Prisma.sql`
        UPDATE "outbox_deliveries" d SET "status" = 'processing',
          "locked_at" = CURRENT_TIMESTAMP, "attempts" = d."attempts" + 1
        FROM "outbox_events" e
        WHERE (d."event_id", d."consumer") = (
          SELECT d2."event_id", d2."consumer" FROM "outbox_deliveries" d2
          WHERE d2."consumer" = 'sms' AND d2."status" IN ('pending', 'failed')
            AND d2."next_attempt_at" <= CURRENT_TIMESTAMP AND d2."attempts" < 20
          ORDER BY d2."next_attempt_at", d2."event_id" FOR UPDATE SKIP LOCKED LIMIT 1
        ) AND e."id" = d."event_id"
        RETURNING d."event_id", e."event_type", e."payload"
      `);
      claimed = rows[0];
      if (!claimed) return;
      const payload = this.object(claimed.payload);
      const target = await this.target(claimed.event_type, payload);
      if (target) {
        await this.sms.enqueue(target.phone, target.template, target.parameters, `outbox:${claimed.event_id}:${target.template}`);
      }
      await this.prisma.outbox_deliveries.update({ where: { event_id_consumer: { event_id: claimed.event_id, consumer: "sms" } }, data: { status: "delivered", delivered_at: new Date(), locked_at: null, last_error: null } });
    } catch (error) {
      if (claimed) await this.prisma.outbox_deliveries.update({ where: { event_id_consumer: { event_id: claimed.event_id, consumer: "sms" } }, data: { status: "failed", locked_at: null, last_error: this.code(error), next_attempt_at: new Date(Date.now() + 60_000) } });
      this.logger.warn(`SMS outbox event failed: ${this.code(error)}`);
    } finally { this.running = false; }
  }

  private async target(eventType: string, payload: Record<string, unknown>) {
    const orderId = typeof payload.orderId === "string" ? payload.orderId : "";
    if (!orderId) return null;
    if (eventType === "order.paid") {
      const order = await this.prisma.orders.findUnique({ where: { id: orderId }, select: { seller: { select: { phone_number: true } } } });
      if (!order?.seller.phone_number) return null;
      return { phone: normalizeIranianPhone(order.seller.phone_number), template: "seller_new_order" as SmsTemplate, parameters: { orderId } };
    }
    const order = await this.prisma.orders.findUnique({ where: { id: orderId }, select: { buyer: { select: { phone_number: true } } } });
    if (!order?.buyer.phone_number) return null;
    return {
      phone: order.buyer.phone_number,
      template: eventType === "bridge.fulfillment.succeeded" ? "buyer_success" as const : "buyer_failure" as const,
      parameters: { orderId }
    };
  }

  private object(value: Prisma.JsonValue) { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
  private code(error: unknown) { return (error instanceof Error ? error.constructor.name : "SmsOutboxError").slice(0, 200); }
}
