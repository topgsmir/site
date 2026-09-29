import type { Prisma } from "../../prisma/client";

export async function commercialBlockers(tx: Prisma.TransactionClient, id: string, source: string | null) {
  const commercialScope: Prisma.ordersWhereInput = { OR: [{ buyer_id: id }, ...(source ? [{ seller_id: source }] : [])] };
  const blockers = {
    orders: await tx.orders.count({ where: { ...commercialScope, status: { notIn: ["delivered", "cancelled"] } } }),
    checkouts: await tx.checkouts.count({ where: { buyer_id: id, status: { in: ["pending_payment", "partially_paid"] } } }),
    walletBalance: await tx.wallet_accounts.count({ where: { user_id: id, balance: { gt: 0 } } }),
    walletTopups: await tx.wallet_topups.count({ where: { user_id: id, status: { in: ["created", "initiating", "initiation_unknown", "pending"] } } }),
    payments: await tx.payment_attempts.count({ where: { order: commercialScope, status: { in: ["created", "initiating", "initiation_unknown", "pending", "refund_pending", "refund_unknown"] } } }),
    refunds: await tx.payment_refunds.count({ where: { payment_attempt: { order: commercialScope }, status: { not: "succeeded" } } }),
    payouts: source ? await tx.payout_ledger.count({ where: { seller_id: source, status: { not: "settled" }, order: { status: { not: "cancelled" } } } }) : 0,
    fulfillment: await tx.bridge_fulfillments.count({ where: { order_item: { order: { ...commercialScope, status: { not: "cancelled" } } }, status: { notIn: ["succeeded", "refunded"] } } }),
    shipping: await tx.shipping_dispatches.count({ where: { order: { ...commercialScope, status: { not: "cancelled" } }, status: { notIn: ["registered", "tracking_available"] } } }),
    aiRuns: await tx.ai_runs.count({ where: { requester_id: id, status: { in: ["awaiting_approval", "running"] } } })
  };
  return blockers;
}
