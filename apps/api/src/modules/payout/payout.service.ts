import {
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException
} from "@nestjs/common";
import { Prisma, payout_status } from "../../prisma/client";
import type { AppUser } from "@topgsm/shared-types";
import { createHash } from "node:crypto";
import { PrismaService } from "../../prisma/prisma.service";
import type {
  ListPayoutsQueryDto,
  SetPayoutStatusDto
} from "./dto/payout.dto";

const payoutSelect = {
  id: true,
  order_id: true,
  seller_id: true,
  gross_amount: true,
  commission_amount: true,
  holdback_amount: true,
  payable_amount: true,
  currency: true,
  status: true,
  requested_at: true,
  approved_at: true,
  settled_at: true,
  created_at: true,
  updated_at: true,
  seller: { select: { shop_name: true } },
  order: { select: { status: true } }
} satisfies Prisma.payout_ledgerSelect;

type PayoutRecord = Prisma.payout_ledgerGetPayload<{ select: typeof payoutSelect }>;

@Injectable()
export class PayoutService {
  constructor(private readonly prisma: PrismaService) {}

  async list(actor: AppUser, input: ListPayoutsQueryDto) {
    const sellerId = await this.sellerScope(actor);
    if (input.cursor) {
      const cursor = await this.prisma.payout_ledger.findFirst({
        where: { id: input.cursor, ...(sellerId ? { seller_id: sellerId } : {}) },
        select: { id: true }
      });
      if (!cursor) throw new NotFoundException("Payout page cursor was not found");
    }
    const rows = await this.prisma.payout_ledger.findMany({
      where: sellerId ? { seller_id: sellerId } : {},
      ...(input.cursor ? { cursor: { id: input.cursor }, skip: 1 } : {}),
      take: input.limit + 1,
      orderBy: [{ created_at: "desc" }, { id: "desc" }],
      select: payoutSelect
    });
    const hasMore = rows.length > input.limit;
    const page = hasMore ? rows.slice(0, input.limit) : rows;
    return {
      items: page.map((row) => this.map(row)),
      nextCursor: hasMore ? page.at(-1)?.id ?? null : null
    };
  }

  async get(actor: AppUser, id: string) {
    const sellerId = await this.sellerScope(actor);
    const row = await this.prisma.payout_ledger.findFirst({
      where: { id, ...(sellerId ? { seller_id: sellerId } : {}) },
      select: payoutSelect
    });
    if (!row) throw new NotFoundException("Payout was not found");
    return this.map(row);
  }

  async request(actor: AppUser, orderId: string, idempotencyKey: string) {
    const sellerId = await this.requiredSeller(actor);
    const requestHash = this.hash({ orderId, status: "requested" });

    try {
      const payout = await this.serializable(async (transaction) => {
        const replay = await transaction.payout_events.findUnique({
          where: {
            actor_user_id_idempotency_key: {
              actor_user_id: actor.id,
              idempotency_key: idempotencyKey
            }
          },
          select: { request_hash: true, payout: { select: payoutSelect } }
        });
        if (replay) {
          this.assertSameRequest(replay.request_hash, requestHash);
          return replay.payout;
        }

        const current = await transaction.payout_ledger.findFirst({
          where: {
            order_id: orderId,
            seller_id: sellerId,
            order: { status: "delivered" }
          },
          select: payoutSelect
        });
        if (!current) throw new NotFoundException("Eligible payout was not found");
        if (current.status !== "draft") {
          throw new ConflictException("Only a draft payout can be requested");
        }

        const changed = await transaction.payout_ledger.updateMany({
          where: { id: current.id, seller_id: sellerId, status: "draft" },
          data: { status: "requested", requested_at: new Date() }
        });
        if (changed.count !== 1) {
          throw new ConflictException("The payout changed; reload and try again");
        }
        await this.recordTransition(
          transaction,
          current,
          actor.id,
          "requested",
          idempotencyKey,
          requestHash
        );
        return transaction.payout_ledger.findUniqueOrThrow({
          where: { id: current.id },
          select: payoutSelect
        });
      });
      return this.map(payout);
    } catch (error) {
      return this.replayOrThrow(error, actor.id, idempotencyKey, requestHash);
    }
  }

  async setStatus(
    actor: AppUser,
    payoutId: string,
    input: SetPayoutStatusDto,
    idempotencyKey: string
  ) {
    if (!this.hasPlatformPayoutPermission(actor)) {
      throw new ForbiddenException("Platform administrator access is required");
    }
    const requestHash = this.hash({ payoutId, status: input.status });

    try {
      const payout = await this.serializable(async (transaction) => {
        const replay = await transaction.payout_events.findUnique({
          where: {
            actor_user_id_idempotency_key: {
              actor_user_id: actor.id,
              idempotency_key: idempotencyKey
            }
          },
          select: { request_hash: true, payout: { select: payoutSelect } }
        });
        if (replay) {
          this.assertSameRequest(replay.request_hash, requestHash);
          return replay.payout;
        }

        const current = await transaction.payout_ledger.findUnique({
          where: { id: payoutId },
          select: payoutSelect
        });
        if (!current) throw new NotFoundException("Payout was not found");
        this.assertAdminTransition(current.status, input.status);

        const now = new Date();
        const changed = await transaction.payout_ledger.updateMany({
          where: { id: payoutId, status: current.status },
          data: {
            status: input.status,
            ...(input.status === "approved" ? { approved_at: now } : {}),
            ...(input.status === "settled" ? { settled_at: now } : {})
          }
        });
        if (changed.count !== 1) {
          throw new ConflictException("The payout changed; reload and try again");
        }
        await this.recordTransition(
          transaction,
          current,
          actor.id,
          input.status,
          idempotencyKey,
          requestHash
        );
        return transaction.payout_ledger.findUniqueOrThrow({
          where: { id: payoutId },
          select: payoutSelect
        });
      });
      return this.map(payout);
    } catch (error) {
      return this.replayOrThrow(error, actor.id, idempotencyKey, requestHash);
    }
  }

  private async recordTransition(
    transaction: Prisma.TransactionClient,
    current: PayoutRecord,
    actorUserId: string,
    to: payout_status,
    idempotencyKey: string,
    requestHash: string
  ) {
    await transaction.payout_events.create({
      data: {
        payout_id: current.id,
        actor_user_id: actorUserId,
        from_status: current.status,
        to_status: to,
        idempotency_key: idempotencyKey,
        request_hash: requestHash
      }
    });
    await transaction.outbox_events.create({
      data: {
        aggregate: "payout",
        aggregate_id: current.id,
        event_type: "payout.status.updated",
        dedupe_key: `payout.status.updated:${actorUserId}:${idempotencyKey}`,
        payload: {
          payoutId: current.id,
          orderId: current.order_id,
          sellerId: current.seller_id,
          fromStatus: current.status,
          status: to
        }
      }
    });
  }

  private async replayOrThrow(
    error: unknown,
    actorUserId: string,
    idempotencyKey: string,
    requestHash: string
  ) {
    if (this.isUniqueConflict(error)) {
      const replay = await this.prisma.payout_events.findUnique({
        where: {
          actor_user_id_idempotency_key: {
            actor_user_id: actorUserId,
            idempotency_key: idempotencyKey
          }
        },
        select: { request_hash: true, payout: { select: payoutSelect } }
      });
      if (replay) {
        this.assertSameRequest(replay.request_hash, requestHash);
        return this.map(replay.payout);
      }
    }
    throw error;
  }

  private async sellerScope(actor: AppUser) {
    if (this.hasPlatformPayoutPermission(actor)) return null;
    if (actor.role === "buyer") throw new ForbiddenException("Payout access is not allowed");
    return this.requiredSeller(actor);
  }

  private async requiredSeller(actor: AppUser) {
    if (actor.role !== "seller-admin" && actor.role !== "seller-staff") {
      throw new ForbiddenException("Seller access is required");
    }
    const seller = await this.prisma.sellers.findFirst({
      where: {
        user_id: actor.id,
        invited: false,
        approved: true,
        suspended_at: null,
        permissions: { some: { permission: "payouts_request" } }
      },
      select: { id: true }
    });
    if (!seller) {
      throw new ForbiddenException("Active seller payout permission is required");
    }
    return seller.id;
  }

  private assertAdminTransition(from: payout_status, to: SetPayoutStatusDto["status"]) {
    const allowed =
      (from === "requested" && (to === "approved" || to === "disputed")) ||
      (from === "approved" && (to === "settled" || to === "disputed"));
    if (!allowed) throw new ConflictException(`Transition from ${from} to ${to} is not allowed`);
  }

  private hasPlatformPayoutPermission(actor: AppUser) {
    return (
      actor.role === "platform-admin" ||
      (actor.role === "platform-staff" &&
        actor.platformPermissions?.includes("payouts_manage") === true)
    );
  }

  private async serializable<T>(
    work: (transaction: Prisma.TransactionClient) => Promise<T>
  ) {
    for (let attempt = 0; ; attempt += 1) {
      try {
        return await this.prisma.$transaction(work, {
          isolationLevel: Prisma.TransactionIsolationLevel.Serializable
        });
      } catch (error) {
        if (
          attempt >= 2 ||
          !(error instanceof Prisma.PrismaClientKnownRequestError) ||
          error.code !== "P2034"
        ) {
          throw error;
        }
      }
    }
  }

  private assertSameRequest(stored: string, incoming: string) {
    if (stored.trim() !== incoming) {
      throw new ConflictException("Idempotency-Key was already used for another request");
    }
  }

  private isUniqueConflict(error: unknown) {
    return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
  }

  private hash(value: unknown) {
    return createHash("sha256").update(JSON.stringify(value)).digest("hex");
  }

  private map(row: PayoutRecord) {
    return {
      id: row.id,
      orderId: row.order_id,
      seller: { id: row.seller_id, shopName: row.seller.shop_name },
      orderStatus: row.order.status,
      grossAmount: row.gross_amount.toString(),
      commissionAmount: row.commission_amount.toString(),
      holdbackAmount: row.holdback_amount.toString(),
      payableAmount: row.payable_amount.toString(),
      currency: row.currency.trim(),
      status: row.status,
      requestedAt: row.requested_at?.toISOString() ?? null,
      approvedAt: row.approved_at?.toISOString() ?? null,
      settledAt: row.settled_at?.toISOString() ?? null,
      createdAt: row.created_at.toISOString(),
      updatedAt: row.updated_at.toISOString()
    };
  }
}
