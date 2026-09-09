import { Injectable, Logger, OnModuleDestroy, OnModuleInit, RequestTimeoutException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Prisma } from "../../prisma/client";
import { createHash, randomUUID } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { BridgeProviderService } from "./bridge-provider.service";
import { CredentialCryptoService } from "./credential-crypto.service";

type ClaimedFulfillment = { id: string; status: "submitting" | "polling" };

@Injectable()
export class BridgeFulfillmentWorkerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BridgeFulfillmentWorkerService.name);
  private readonly workerId = randomUUID();
  private timer?: NodeJS.Timeout;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly providers: BridgeProviderService,
    private readonly crypto: CredentialCryptoService,
    private readonly config: ConfigService
  ) {}

  onModuleInit() {
    if (this.config.get<string>("DISABLE_BACKGROUND_WORKERS") === "true" || this.config.get<string>("BRIDGE_FEATURE_ENABLED") !== "true") return;
    this.timer = setInterval(() => void this.tick(), 2_000);
    this.timer.unref();
  }

  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      const rows = await this.prisma.$queryRaw<ClaimedFulfillment[]>(Prisma.sql`
        UPDATE "bridge_fulfillments" SET
          "status" = CASE WHEN "status" = 'queued' THEN 'submitting'::"bridge_fulfillment_status" ELSE 'polling'::"bridge_fulfillment_status" END,
          "locked_at" = CURRENT_TIMESTAMP, "locked_by" = ${this.workerId}, "updated_at" = CURRENT_TIMESTAMP
        WHERE "id" = (
          SELECT "id" FROM "bridge_fulfillments"
          WHERE "mode" = 'automatic'
            AND "status" IN ('queued', 'submitted', 'polling')
            AND ("next_attempt_at" IS NULL OR "next_attempt_at" <= CURRENT_TIMESTAMP)
            AND ("locked_at" IS NULL OR "locked_at" < CURRENT_TIMESTAMP - INTERVAL '2 minutes')
          ORDER BY COALESCE("next_attempt_at", "created_at"), "created_at"
          FOR UPDATE SKIP LOCKED LIMIT 1
        ) RETURNING "id", "status"
      `);
      if (rows[0]) await this.process(rows[0]);
    } catch (error) {
      this.logger.error(`Bridge worker tick failed: ${this.code(error)}`);
    } finally { this.running = false; }
  }

  private async process(claim: ClaimedFulfillment) {
    const job = await this.prisma.bridge_fulfillments.findUnique({
      where: { id: claim.id },
      include: {
        order_item: { include: { order: { select: { id: true, buyer_id: true, seller_id: true, status: true } } } },
        grant: { include: { service: { include: { connection: true } } } }
      }
    });
    if (!job) return;
    const connection = job.grant.service.connection;
    const credentials = {
      baseUrl: connection.base_url,
      username: this.crypto.decrypt(connection.encrypted_username, connection.encryption_key_id, `bridge:${connection.id}:username`),
      apiKey: this.crypto.decrypt(connection.encrypted_api_key, connection.encryption_key_id, `bridge:${connection.id}:api-key`)
    };
    const provider = this.providers.get(connection.provider);

    if (claim.status === "submitting") {
      if (job.grant.status !== "active" || !job.grant.service.available || connection.status !== "active") {
        await this.manual(job.id, "GRANT_OR_CONNECTION_UNAVAILABLE");
        return;
      }
      const input = JSON.parse(this.crypto.decrypt(job.encrypted_input, job.encryption_key_id, `bridge-fulfillment:${job.id}:input`)) as { fields: Record<string, string>; quantity: number };
      await this.prisma.bridge_fulfillments.update({ where: { id: job.id }, data: { submit_attempts: { increment: 1 } } });
      try {
        const result = await provider.submitOrder(credentials, {
          serviceExternalId: job.grant.service.external_service_id,
          kind: job.grant.service.kind,
          fields: input.fields,
          quantity: input.quantity
        });
        await this.recordAttempt(job.id, "submit", input, result.status, null);
        if (result.status === "success") {
          await this.complete(job, result.result ?? { providerReference: result.providerReference }, result.providerReference);
        } else if (result.status === "failed") {
          await this.fail(job, result.diagnosticCode ?? "PROVIDER_REJECTED");
        } else {
          await this.prisma.bridge_fulfillments.update({
            where: { id: job.id },
            data: { status: "submitted", provider_reference: result.providerReference, submitted_at: new Date(), next_attempt_at: new Date(Date.now() + 30_000), locked_at: null, locked_by: null }
          });
        }
      } catch (error) {
        await this.recordAttempt(job.id, "submit", input, "error", this.code(error));
        // Once a request could have reached the provider, an automatic retry can
        // double-charge the seller. Timeouts and transport failures need review.
        if (error instanceof RequestTimeoutException || this.isAmbiguous(error)) {
          await this.manual(job.id, "AMBIGUOUS_SUBMISSION");
        } else if (job.submit_attempts < 1) {
          await this.prisma.bridge_fulfillments.update({ where: { id: job.id }, data: { status: "queued", next_attempt_at: new Date(Date.now() + 30_000), locked_at: null, locked_by: null, last_error_code: this.code(error) } });
        } else {
          await this.manual(job.id, "SUBMISSION_FAILED");
        }
      }
      return;
    }

    if (!job.provider_reference) {
      await this.manual(job.id, "MISSING_PROVIDER_REFERENCE");
      return;
    }
    if (Date.now() - job.created_at.getTime() > 7 * 24 * 60 * 60 * 1000) {
      await this.manual(job.id, "PROVIDER_OPERATION_TIMEOUT");
      return;
    }
    try {
      const result = await provider.checkOrder(credentials, { providerReference: job.provider_reference, kind: job.grant.service.kind });
      await this.recordAttempt(job.id, "poll", { reference: job.provider_reference }, result.status, result.diagnosticCode ?? null);
      if (result.status === "success") await this.complete(job, result.result ?? {}, job.provider_reference);
      else if (result.status === "failed") await this.fail(job, result.diagnosticCode ?? "PROVIDER_REJECTED");
      else await this.prisma.bridge_fulfillments.update({ where: { id: job.id }, data: { status: "polling", next_attempt_at: new Date(Date.now() + 60_000), locked_at: null, locked_by: null } });
    } catch (error) {
      await this.recordAttempt(job.id, "poll", { reference: job.provider_reference }, "error", this.code(error));
      await this.prisma.bridge_fulfillments.update({ where: { id: job.id }, data: { status: "polling", next_attempt_at: new Date(Date.now() + 5 * 60_000), locked_at: null, locked_by: null, last_error_code: this.code(error) } });
    }
  }

  private async complete(job: { id: string; encryption_key_id: string; order_item: { order: { id: string; buyer_id: string; seller_id: string; status: string } } }, result: Record<string, unknown>, providerReference: string) {
    const encrypted = this.crypto.encrypt(JSON.stringify(result), `bridge-fulfillment:${job.id}:result`);
    await this.prisma.$transaction(async (transaction) => {
      const changed = await transaction.bridge_fulfillments.updateMany({
        where: { id: job.id, status: { in: ["submitting", "submitted", "polling"] } },
        data: { status: "succeeded", encrypted_result: encrypted.ciphertext, result_encryption_key_id: encrypted.keyId, provider_reference: providerReference, completed_at: new Date(), next_attempt_at: null, locked_at: null, locked_by: null, last_error_code: null }
      });
      if (changed.count !== 1) return;
      const order = job.order_item.order;
      if (order.status !== "delivered") {
        await transaction.orders.update({ where: { id: order.id }, data: { status: "delivered" } });
        await transaction.order_events.create({ data: { order_id: order.id, actor_user_id: order.buyer_id, from_status: order.status as "paid" | "processing", to_status: "delivered", idempotency_key: randomUUID(), request_hash: this.hash({ fulfillmentId: job.id, status: "succeeded" }) } });
      }
      await transaction.outbox_events.create({ data: { aggregate: "order", aggregate_id: order.id, event_type: "bridge.fulfillment.succeeded", dedupe_key: `bridge.fulfillment.succeeded:${job.id}`, payload: { orderId: order.id, buyerId: order.buyer_id, sellerId: order.seller_id, fulfillmentId: job.id, status: "delivered" } } });
    });
  }

  private async fail(job: { id: string; order_item: { order: { id: string; buyer_id: string; seller_id: string } } }, code: string) {
    await this.prisma.$transaction(async (transaction) => {
      await transaction.bridge_fulfillments.update({ where: { id: job.id }, data: { status: "failed", last_error_code: code, completed_at: new Date(), next_attempt_at: null, locked_at: null, locked_by: null } });
      const order = job.order_item.order;
      await transaction.outbox_events.create({ data: { aggregate: "order", aggregate_id: order.id, event_type: "bridge.fulfillment.failed", dedupe_key: `bridge.fulfillment.failed:${job.id}`, payload: { orderId: order.id, buyerId: order.buyer_id, sellerId: order.seller_id, fulfillmentId: job.id, errorCode: code } } });
    });
  }

  private manual(id: string, code: string) {
    return this.prisma.bridge_fulfillments.update({ where: { id }, data: { status: "manual_required", last_error_code: code, next_attempt_at: null, locked_at: null, locked_by: null } });
  }

  private recordAttempt(fulfillmentId: string, action: string, request: unknown, outcome: string, errorCode: string | null) {
    return this.prisma.bridge_fulfillment_attempts.create({ data: { fulfillment_id: fulfillmentId, action, request_hash: this.hash(request), outcome, error_code: errorCode } });
  }

  private hash(value: unknown) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
  private code(error: unknown) { return (error instanceof Error ? error.constructor.name : "BridgeError").replace(/[^A-Za-z0-9_]/g, "_").slice(0, 64).toUpperCase(); }
  private isAmbiguous(error: unknown) { return error instanceof Error && /gateway|fetch|network|socket|abort/i.test(`${error.name} ${error.message}`); }
}
