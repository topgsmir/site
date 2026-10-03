import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Optional } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "../../prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { normalizeIranianPhone } from "./phone-number";
import { SmsService } from "./sms.service";
import { SmsSettingsService } from "./sms-settings.service";
import { SmsRulesService } from "./sms-rules.service";

type ClaimedEvent = { event_id: string; event_type: string; payload: Prisma.JsonValue };

@Injectable()
export class SmsOutboxConsumerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SmsOutboxConsumerService.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  constructor(private readonly prisma: PrismaService, private readonly sms: SmsService, private readonly rules: SmsRulesService, private readonly config: ConfigService, @Optional() private readonly settings?: SmsSettingsService) {}

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
        WHERE "event_type" IN ('order.paid', 'order.status.updated', 'bridge.fulfillment.succeeded', 'bridge.fulfillment.failed', 'search.empty', 'product.pending.alert', 'club.wallet.redeemed', 'club.points.expiring')
        ON CONFLICT DO NOTHING
      `);
      const rows = await this.prisma.$queryRaw<ClaimedEvent[]>(Prisma.sql`
        UPDATE "outbox_deliveries" d SET "status" = 'processing',
          "locked_at" = CURRENT_TIMESTAMP, "attempts" = d."attempts" + 1
        FROM "outbox_events" e
        WHERE (d."event_id", d."consumer") = (
          SELECT d2."event_id", d2."consumer" FROM "outbox_deliveries" d2
          WHERE d2."consumer" = 'sms'
            AND (d2."status" IN ('pending', 'failed') OR (d2."status" = 'processing' AND d2."locked_at" < CURRENT_TIMESTAMP - INTERVAL '5 minutes'))
            AND d2."next_attempt_at" <= CURRENT_TIMESTAMP AND d2."attempts" < 20
          ORDER BY d2."next_attempt_at", d2."event_id" FOR UPDATE SKIP LOCKED LIMIT 1
        ) AND e."id" = d."event_id"
        RETURNING d."event_id", e."event_type", e."payload"
      `);
      claimed = rows[0];
      if (!claimed) return;
      const payload = this.object(claimed.payload);
      await this.dispatch(claimed.event_id, claimed.event_type, payload);
      await this.prisma.outbox_deliveries.update({ where: { event_id_consumer: { event_id: claimed.event_id, consumer: "sms" } }, data: { status: "delivered", delivered_at: new Date(), locked_at: null, last_error: null } });
    } catch (error) {
      if (claimed) await this.prisma.outbox_deliveries.update({ where: { event_id_consumer: { event_id: claimed.event_id, consumer: "sms" } }, data: { status: "failed", locked_at: null, last_error: this.code(error), next_attempt_at: new Date(Date.now() + 60_000) } });
      this.logger.warn(`SMS outbox event failed: ${this.code(error)}`);
    } finally { this.running = false; }
  }

  private async dispatch(eventId: string, eventType: string, payload: Record<string, unknown>) {
    if (eventType === "club.wallet.redeemed" || eventType === "club.points.expiring") {
      const userId = typeof payload.userId === "string" ? payload.userId : "";
      if (!userId || !this.settings) return;
      const configuration = await this.settings.get();
      const expiry = eventType === "club.points.expiring";
      if (!(expiry ? configuration.templateIds.clubExpiry : configuration.templateIds.clubRedemption)) return;
      const user = await this.prisma.users.findUnique({ where: { id: userId }, select: { phone_number: true } });
      if (!user?.phone_number) return;
      const parameters: Record<string, string> = expiry
        ? { points: String(payload.points ?? ""), expiresAt: String(payload.expiresAt ?? "") }
        : { amount: String(payload.amount ?? "") };
      const template = expiry ? "club_expiry" as const : "club_redemption" as const;
      await this.sms.enqueue(normalizeIranianPhone(user.phone_number), template, parameters, `outbox:${eventId}:${template}`);
      return;
    }
    if (eventType === "search.empty") {
      const query = typeof payload.query === "string" ? payload.query : "";
      if (query) await this.rules.dispatch("search_empty", { id: eventId, parameters: { query } });
      return;
    }
    if (eventType === "product.pending.alert") {
      const pendingCount = typeof payload.pendingCount === "number" ? payload.pendingCount : 0;
      if (pendingCount > 0) await this.rules.dispatch("pending_product", { id: eventId, parameters: { pendingCount: String(pendingCount) } });
      return;
    }
    const orderId = typeof payload.orderId === "string" ? payload.orderId : "";
    if (!orderId) return;
    if (eventType === "order.status.updated" && payload.status !== "shipped") return;
    const order = await this.prisma.orders.findUnique({ where: { id: orderId }, select: {
      buyer: { select: { phone_number: true } }, seller: { select: { phone_number: true } },
      items: { select: { product_type: true } }
    } });
    if (!order) return;
    const eventKey = eventType === "order.paid" ? "product_sold" : eventType === "order.status.updated" ? "physical_order_shipped" : eventType === "bridge.fulfillment.succeeded" ? "bridge_success" : "bridge_failure";
    if (eventKey === "physical_order_shipped" && !order.items.some((item) => item.product_type === "physical")) return;
    const types = eventKey === "product_sold" ? [...new Set(order.items.map((item) => item.product_type))] : eventKey === "physical_order_shipped" ? ["physical" as const] : ["bridge" as const];
    for (const productType of types) await this.rules.dispatch(eventKey, {
      id: eventId, productType, buyerPhone: order.buyer.phone_number, sellerPhone: order.seller.phone_number,
      parameters: { orderId, productType }
    });
  }

  private object(value: Prisma.JsonValue) { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
  private code(error: unknown) { return (error instanceof Error ? error.constructor.name : "SmsOutboxError").slice(0, 200); }
}
