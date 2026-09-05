import { Injectable } from "@nestjs/common";
import { PayoutStatus } from "@topgsm/shared-types";

type LedgerRow = {
  id: string;
  orderId: string;
  sellerId: string;
  grossAmount: number;
  commissionAmount: number;
  holdbackAmount: number;
  payableAmount: number;
  currency: string;
  status: PayoutStatus;
};

const ledger: LedgerRow[] = [];

@Injectable()
export class PayoutService {
  private readonly commissionPercent = 0.1;
  private readonly holdbackPercent = 0.05;

  recordDraft(orderId: string, sellerId: string, grossAmount: number, currency: string) {
    const commission = grossAmount * this.commissionPercent;
    const holdback = grossAmount * this.holdbackPercent;
    const payable = grossAmount - commission - holdback;
    const row: LedgerRow = {
      id: `payout-${orderId}`,
      orderId,
      sellerId,
      grossAmount,
      commissionAmount: Number(commission.toFixed(2)),
      holdbackAmount: Number(holdback.toFixed(2)),
      payableAmount: Number(payable.toFixed(2)),
      currency,
      status: "draft"
    };
    ledger.push(row);
    return row;
  }

  updateFromOrderStatus(orderId: string, status: string) {
    const row = ledger.find((item) => item.orderId === orderId);
    if (!row) {
      return null;
    }

    if (status === "cancelled") {
      row.status = "disputed";
      return row;
    }
    if (status === "delivered") {
      row.status = "approved";
      return row;
    }
    return row;
  }

  listAll() {
    return ledger;
  }

  get(id: string) {
    return ledger.find((item) => item.id === id) ?? null;
  }

  request({ orderId, sellerId, requestedAmount }: { orderId: string; sellerId: string; requestedAmount: number }) {
    const row = ledger.find(
      (item) => item.orderId === orderId && item.sellerId === sellerId
    );
    if (!row) {
      return { message: "ledger row not found" };
    }
    if (requestedAmount > row.payableAmount) {
      return {
        message: "requestedAmount must be <= payable amount"
      };
    }
    row.status = "requested";
    return row;
  }

  setStatus(id: string, status: PayoutStatus) {
    const row = ledger.find((item) => item.id === id);
    if (!row) {
      return { message: "ledger row not found" };
    }
    row.status = status;
    return row;
  }
}
