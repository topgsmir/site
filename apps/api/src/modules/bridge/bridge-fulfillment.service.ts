import { ConflictException, ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import { createHash, randomUUID } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service";
import { CredentialCryptoService } from "./credential-crypto.service";
import { BridgeProviderService } from "./bridge-provider.service";

@Injectable()
export class BridgeFulfillmentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly crypto: CredentialCryptoService,
    private readonly providers: BridgeProviderService
  ) {}

  async listSeller(sellerId: string, userId: string) {
    await this.requireOrderPermission(sellerId, userId);
    const rows = await this.prisma.bridge_fulfillments.findMany({
      where: { order_item: { order: { seller_id: sellerId } } },
      include: {
        order_item: { select: { order_id: true, product_title: true, quantity: true } },
        grant: { select: { service: { select: { name: true } } } }
      },
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
      take: 100
    });
    if (rows.length) await this.prisma.bridge_data_access_audits.createMany({ data: rows.map((row) => ({ fulfillment_id: row.id, user_id: userId, access_kind: "seller_list" })) });
    return rows.map((row) => ({
      id: row.id,
      orderId: row.order_item.order_id,
      productTitle: row.order_item.product_title,
      serviceName: row.grant.service.name,
      quantity: row.order_item.quantity,
      mode: row.mode,
      status: row.status,
      fields: this.decryptJson(row.encrypted_input, row.encryption_key_id, `bridge-fulfillment:${row.id}:input`),
      result: row.encrypted_result && row.result_encryption_key_id
        ? this.decryptJson(row.encrypted_result, row.result_encryption_key_id, `bridge-fulfillment:${row.id}:result`)
        : null,
      providerReference: row.provider_reference,
      errorCode: row.last_error_code,
      mayRetry: row.manual_retry_count === 0 && ["failed", "manual_required"].includes(row.status),
      createdAt: row.created_at.toISOString(),
      completedAt: row.completed_at?.toISOString() ?? null
    }));
  }

  async completeManual(sellerId: string, userId: string, id: string, result: string) {
    await this.requireOrderPermission(sellerId, userId);
    const job = await this.owned(sellerId, id);
    if (!["manual_required", "failed"].includes(job.status)) throw new ConflictException("Fulfillment is not awaiting manual delivery");
    const encrypted = this.crypto.encrypt(JSON.stringify({ result: result.trim() }), `bridge-fulfillment:${job.id}:result`);
    await this.prisma.$transaction(async (transaction) => {
      const changed = await transaction.bridge_fulfillments.updateMany({
        where: { id: job.id, status: { in: ["manual_required", "failed"] } },
        data: { status: "succeeded", encrypted_result: encrypted.ciphertext, result_encryption_key_id: encrypted.keyId, completed_at: new Date(), last_error_code: null, next_attempt_at: null }
      });
      if (changed.count !== 1) throw new ConflictException("Fulfillment changed; reload and try again");
      await transaction.orders.update({ where: { id: job.order_item.order.id }, data: { status: "delivered" } });
      await transaction.order_events.create({ data: { order_id: job.order_item.order.id, actor_user_id: userId, from_status: job.order_item.order.status, to_status: "delivered", idempotency_key: randomUUID(), request_hash: this.hash({ id, result }) } });
      await transaction.outbox_events.create({ data: { aggregate: "order", aggregate_id: job.order_item.order.id, event_type: "bridge.fulfillment.succeeded", dedupe_key: `bridge.fulfillment.succeeded:${job.id}`, payload: { orderId: job.order_item.order.id, buyerId: job.order_item.order.buyer_id, sellerId, fulfillmentId: job.id, status: "delivered" } } });
    });
    return { delivered: true };
  }

  async retry(sellerId: string, userId: string, id: string) {
    await this.requireOrderPermission(sellerId, userId);
    const job = await this.prisma.bridge_fulfillments.findFirst({
      where: { id, order_item: { order: { seller_id: sellerId } }, status: { in: ["failed", "manual_required"] }, manual_retry_count: 0 },
      include: { grant: { include: { service: { include: { connection: true } } } }, order_item: { include: { order: { select: { id: true, buyer_id: true, seller_id: true, status: true } } } } }
    });
    if (!job) throw new ConflictException("Fulfillment is not eligible for another retry");
    if (job.last_error_code === "AMBIGUOUS_SUBMISSION" && !job.provider_reference) {
      throw new ConflictException("An ambiguous submission cannot be retried without a provider reference; request a refund");
    }
    if (job.provider_reference) {
      const connection = job.grant.service.connection;
      const status = await this.providers.get(connection.provider).checkOrder({
        baseUrl: connection.base_url,
        username: this.crypto.decrypt(connection.encrypted_username, connection.encryption_key_id, `bridge:${connection.id}:username`),
        apiKey: this.crypto.decrypt(connection.encrypted_api_key, connection.encryption_key_id, `bridge:${connection.id}:api-key`)
      }, { providerReference: job.provider_reference, kind: job.grant.service.kind });
      if (status.status === "pending") throw new ConflictException("The upstream order is still pending and cannot be retried");
      if (status.status === "success") {
        await this.finishReconciled(job, status.result ?? {}, userId);
        return { queued: false, delivered: true, remainingRetries: 1 };
      }
    }
    const changed = await this.prisma.bridge_fulfillments.updateMany({
      where: { id, order_item: { order: { seller_id: sellerId } }, status: { in: ["failed", "manual_required"] }, manual_retry_count: 0 },
      data: { status: "queued", manual_retry_count: 1, provider_reference: null, next_attempt_at: new Date(), last_error_code: null }
    });
    if (changed.count !== 1) throw new ConflictException("Retry is allowed only once");
    return { queued: true, remainingRetries: 0 };
  }

  async requestRefund(buyerId: string, id: string, reason: string) {
    const job = await this.prisma.bridge_fulfillments.findFirst({
      where: { id, order_item: { order: { buyer_id: buyerId } } },
      include: { order_item: { select: { order_id: true } } }
    });
    if (!job) throw new NotFoundException("Fulfillment was not found");
    if (!["failed", "manual_required"].includes(job.status)) throw new ConflictException("This fulfillment is not eligible for a refund request");
    await this.prisma.$transaction([
      this.prisma.bridge_fulfillments.update({ where: { id: job.id }, data: { status: "refund_requested", last_error_code: "BUYER_REFUND_REQUEST" } }),
      this.prisma.outbox_events.create({ data: { aggregate: "order", aggregate_id: job.order_item.order_id, event_type: "bridge.refund.requested", dedupe_key: `bridge.refund.requested:${job.id}`, payload: { orderId: job.order_item.order_id, buyerId, fulfillmentId: job.id, reason: reason.trim() } } })
    ]);
    return { requested: true };
  }

  async listRefundRequests() {
    return this.prisma.bridge_fulfillments.findMany({
      where: { status: "refund_requested" },
      select: {
        id: true,
        last_error_code: true,
        created_at: true,
        order_item: {
          select: {
            order: {
              select: {
                id: true,
                total_amount: true,
                currency: true,
                seller: { select: { id: true, shop_name: true } },
                payment_attempts: { where: { status: "succeeded" }, select: { id: true, authority: true, provider_ref_id: true }, take: 1 }
              }
            }
          }
        }
      },
      orderBy: { created_at: "asc" }
    });
  }

  private async owned(sellerId: string, id: string) {
    const row = await this.prisma.bridge_fulfillments.findFirst({
      where: { id, order_item: { order: { seller_id: sellerId } } },
      include: { order_item: { include: { order: { select: { id: true, buyer_id: true, status: true } } } } }
    });
    if (!row) throw new NotFoundException("Fulfillment was not found");
    return row;
  }

  private async requireOrderPermission(sellerId: string, userId: string) {
    const membership = await this.prisma.seller_memberships.findFirst({
      where: { seller_id: sellerId, user_id: userId, active: true, seller: { permissions: { some: { permission: "orders_manage" } } } },
      select: { seller_id: true }
    });
    if (!membership) throw new ForbiddenException("Seller order-management permission is required");
  }

  private async finishReconciled(
    job: { id: string; order_item: { order: { id: string; buyer_id: string; seller_id: string; status: string } } },
    result: Record<string, unknown>,
    actorUserId: string
  ) {
    const encrypted = this.crypto.encrypt(JSON.stringify(result), `bridge-fulfillment:${job.id}:result`);
    await this.prisma.$transaction(async (transaction) => {
      await transaction.bridge_fulfillments.update({ where: { id: job.id }, data: { status: "succeeded", encrypted_result: encrypted.ciphertext, result_encryption_key_id: encrypted.keyId, completed_at: new Date(), next_attempt_at: null, last_error_code: null } });
      await transaction.orders.update({ where: { id: job.order_item.order.id }, data: { status: "delivered" } });
      await transaction.order_events.create({ data: { order_id: job.order_item.order.id, actor_user_id: actorUserId, from_status: job.order_item.order.status as "paid" | "processing", to_status: "delivered", idempotency_key: randomUUID(), request_hash: this.hash({ fulfillmentId: job.id, reconciled: true }) } });
      await transaction.outbox_events.create({ data: { aggregate: "order", aggregate_id: job.order_item.order.id, event_type: "bridge.fulfillment.succeeded", dedupe_key: `bridge.fulfillment.succeeded:${job.id}`, payload: { orderId: job.order_item.order.id, buyerId: job.order_item.order.buyer_id, sellerId: job.order_item.order.seller_id, fulfillmentId: job.id, status: "delivered" } } });
    });
  }

  private decryptJson(payload: string, keyId: string, purpose: string) {
    return JSON.parse(this.crypto.decrypt(payload, keyId, purpose)) as unknown;
  }
  private hash(value: unknown) { return createHash("sha256").update(JSON.stringify(value)).digest("hex"); }
}
