import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { RealtimeGateway } from "./realtime.gateway";

type OutboxRow = {
  id: string;
  event_type: string;
  payload: Prisma.JsonValue;
};

type StoredPayload = Record<string, unknown> & {
  buyerId?: string;
  sellerId?: string;
};

@Injectable()
export class OutboxPublisherService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(OutboxPublisherService.name);
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly realtime: RealtimeGateway
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.publishBatch(), 1_000);
    this.timer.unref();
    void this.publishBatch();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async publishBatch() {
    if (this.running) return;
    this.running = true;
    try {
      await this.prisma.$transaction(async (transaction) => {
        const rows = await transaction.$queryRaw<OutboxRow[]>(Prisma.sql`
          SELECT "id", "event_type", "payload"
          FROM "outbox_events"
          WHERE "published_at" IS NULL AND "attempts" < 20
          ORDER BY "created_at", "id"
          LIMIT 50
          FOR UPDATE SKIP LOCKED
        `);

        for (const row of rows) {
          const payload = this.objectPayload(row.payload);
          const delivered = this.emit(row.event_type, payload);
          if (!delivered) {
            this.logger.warn(`Unsupported outbox event ${row.event_type} (${row.id})`);
          }
          await transaction.outbox_events.update({
            where: { id: row.id },
            data: {
              attempts: { increment: 1 },
              ...(delivered ? { published_at: new Date() } : {})
            }
          });
        }
      });
    } catch {
      this.logger.error("Realtime outbox batch failed; it will be retried");
    } finally {
      this.running = false;
    }
  }

  private emit(eventType: string, payload: StoredPayload) {
    if (
      (eventType === "order.created" || eventType === "order.status.updated") &&
      typeof payload.buyerId === "string" &&
      typeof payload.sellerId === "string"
    ) {
      const audience = { buyerId: payload.buyerId, sellerId: payload.sellerId };
      const eventPayload = { ...payload };
      delete eventPayload.buyerId;
      delete eventPayload.sellerId;
      if (eventType === "order.created") {
        this.realtime.emitOrderCreated(audience, eventPayload);
      } else {
        this.realtime.emitOrderStatusChanged(audience, eventPayload);
      }
      return true;
    }
    if (
      eventType === "payout.status.updated" &&
      typeof payload.sellerId === "string"
    ) {
      const { sellerId, ...eventPayload } = payload;
      this.realtime.emitPayoutStatusChanged(sellerId, eventPayload);
      return true;
    }
    return false;
  }

  private objectPayload(value: Prisma.JsonValue): StoredPayload {
    return value !== null && typeof value === "object" && !Array.isArray(value)
      ? (value as StoredPayload)
      : {};
  }
}
