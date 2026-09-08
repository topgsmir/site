import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { RealtimeGateway } from "./realtime.gateway";

type ClaimedDelivery = {
  event_id: string;
  event_type: string;
  payload: Prisma.JsonValue;
};
type StoredPayload = Record<string, unknown> & { buyerId?: string; sellerId?: string };

@Injectable()
export class OutboxPublisherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxPublisherService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(private readonly prisma: PrismaService, private readonly realtime: RealtimeGateway, private readonly config: ConfigService) {}

  onModuleInit() {
    if (this.config.get<string>("DISABLE_BACKGROUND_WORKERS") === "true") return;
    this.timer = setInterval(() => void this.publishBatch(), 1_000);
    this.timer.unref();
  }

  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  async publishBatch() {
    if (this.running) return;
    this.running = true;
    try {
      await this.prisma.$executeRaw(Prisma.sql`
        INSERT INTO "outbox_deliveries" ("event_id", "consumer")
        SELECT "id", 'realtime' FROM "outbox_events"
        WHERE "event_type" IN (
          'order.created', 'order.paid', 'order.status.updated',
          'bridge.fulfillment.succeeded', 'bridge.fulfillment.failed',
          'payout.status.updated'
        ) ON CONFLICT DO NOTHING
      `);
      for (let count = 0; count < 50; count += 1) {
        const rows = await this.prisma.$queryRaw<ClaimedDelivery[]>(Prisma.sql`
          UPDATE "outbox_deliveries" d SET "status" = 'processing',
            "locked_at" = CURRENT_TIMESTAMP, "attempts" = d."attempts" + 1
          FROM "outbox_events" e
          WHERE (d."event_id", d."consumer") = (
            SELECT d2."event_id", d2."consumer" FROM "outbox_deliveries" d2
            WHERE d2."consumer" = 'realtime'
              AND d2."status" IN ('pending', 'failed')
              AND d2."next_attempt_at" <= CURRENT_TIMESTAMP
              AND d2."attempts" < 20
            ORDER BY d2."next_attempt_at", d2."event_id"
            FOR UPDATE SKIP LOCKED LIMIT 1
          ) AND e."id" = d."event_id"
          RETURNING d."event_id", e."event_type", e."payload"
        `);
        const delivery = rows[0];
        if (!delivery) break;
        try {
          this.emit(delivery.event_type, this.objectPayload(delivery.payload));
          await this.prisma.$transaction([
            this.prisma.outbox_deliveries.update({ where: { event_id_consumer: { event_id: delivery.event_id, consumer: "realtime" } }, data: { status: "delivered", delivered_at: new Date(), locked_at: null, last_error: null } }),
            this.prisma.outbox_events.update({ where: { id: delivery.event_id }, data: { published_at: new Date(), attempts: { increment: 1 } } })
          ]);
        } catch (error) {
          await this.prisma.outbox_deliveries.update({ where: { event_id_consumer: { event_id: delivery.event_id, consumer: "realtime" } }, data: { status: "failed", locked_at: null, last_error: this.code(error), next_attempt_at: new Date(Date.now() + 30_000) } });
        }
      }
    } catch (error) {
      this.logger.error(`Realtime outbox batch failed: ${this.code(error)}`);
    } finally { this.running = false; }
  }

  private emit(eventType: string, payload: StoredPayload) {
    if (
      ["order.created", "order.paid", "order.status.updated", "bridge.fulfillment.succeeded", "bridge.fulfillment.failed"].includes(eventType) &&
      typeof payload.buyerId === "string" && typeof payload.sellerId === "string"
    ) {
      const audience = { buyerId: payload.buyerId, sellerId: payload.sellerId };
      const { buyerId: _buyerId, sellerId: _sellerId, ...eventPayload } = payload;
      if (eventType === "order.created") this.realtime.emitOrderCreated(audience, eventPayload);
      else this.realtime.emitOrderStatusChanged(audience, eventPayload);
      return;
    }
    if (eventType === "payout.status.updated" && typeof payload.sellerId === "string") {
      const { sellerId, ...eventPayload } = payload;
      this.realtime.emitPayoutStatusChanged(sellerId, eventPayload);
      return;
    }
    throw new Error("unsupported_realtime_event");
  }

  private objectPayload(value: Prisma.JsonValue): StoredPayload {
    return value !== null && typeof value === "object" && !Array.isArray(value) ? value as StoredPayload : {};
  }
  private code(error: unknown) { return (error instanceof Error ? error.constructor.name : "OutboxError").slice(0, 200); }
}
