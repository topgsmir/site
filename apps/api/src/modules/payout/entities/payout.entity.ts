export type PayoutStatus = "draft" | "requested" | "approved" | "settled" | "disputed";

export type PayoutLedger = {
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

