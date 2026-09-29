import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "../../prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { ClubService } from "./club.service";

type Event = { event_id: string; event_type: string; payload: Prisma.JsonValue; created_at: Date };

@Injectable()
export class ClubOutboxWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(ClubOutboxWorker.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  constructor(private readonly prisma: PrismaService, private readonly club: ClubService, private readonly config: ConfigService) {}

  onModuleInit() {
    if (this.config.get<string>("DISABLE_BACKGROUND_WORKERS") === "true") return;
    this.timer = setInterval(() => void this.tick(), 5_000);
    this.timer.unref();
  }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  private async tick() {
    if (this.running) return;
    this.running = true;
    let event: Event | undefined;
    try {
      await this.prisma.$executeRaw(Prisma.sql`
        INSERT INTO outbox_deliveries (event_id, consumer)
        SELECT e.id, 'club' FROM outbox_events e CROSS JOIN club_settings s
        WHERE s.id = 1 AND s.activated_at IS NOT NULL AND e.created_at >= s.activated_at
          AND e.event_type IN ('order.paid','order.status.updated','payment.refunded')
        ON CONFLICT DO NOTHING
      `);
      const rows = await this.prisma.$queryRaw<Event[]>(Prisma.sql`
        UPDATE outbox_deliveries d SET status = 'processing', locked_at = CURRENT_TIMESTAMP, attempts = d.attempts + 1
        FROM outbox_events e
        WHERE (d.event_id, d.consumer) = (
          SELECT d2.event_id, d2.consumer FROM outbox_deliveries d2
          WHERE d2.consumer = 'club'
            AND (d2.status IN ('pending','failed') OR (d2.status = 'processing' AND d2.locked_at < CURRENT_TIMESTAMP - INTERVAL '5 minutes'))
            AND d2.next_attempt_at <= CURRENT_TIMESTAMP AND d2.attempts < 20
          ORDER BY d2.next_attempt_at, d2.event_id FOR UPDATE SKIP LOCKED LIMIT 1
        ) AND e.id = d.event_id
        RETURNING d.event_id, e.event_type, e.payload, e.created_at
      `);
      event = rows[0];
      if (event) {
        const payload = event.payload && typeof event.payload === "object" && !Array.isArray(event.payload) ? event.payload as Record<string, unknown> : {};
        const orderId = typeof payload.orderId === "string" ? payload.orderId : "";
        if (orderId && event.event_type === "order.paid") await this.club.processPaid(orderId, event.created_at);
        if (orderId && (event.event_type === "payment.refunded" || (event.event_type === "order.status.updated" && payload.status === "cancelled"))) await this.club.processReversal(orderId);
        await this.prisma.outbox_deliveries.update({ where: { event_id_consumer: { event_id: event.event_id, consumer: "club" } }, data: { status: "delivered", delivered_at: new Date(), locked_at: null, last_error: null } });
      }
      await this.club.expireDue();
    } catch (error) {
      if (event) await this.prisma.outbox_deliveries.update({ where: { event_id_consumer: { event_id: event.event_id, consumer: "club" } }, data: { status: "failed", locked_at: null, last_error: error instanceof Error ? error.constructor.name : "ClubError", next_attempt_at: new Date(Date.now() + 60_000) } });
      this.logger.error(`Club worker tick failed: ${error instanceof Error ? error.constructor.name : "UnknownError"}`);
    } finally { this.running = false; }
  }
}
