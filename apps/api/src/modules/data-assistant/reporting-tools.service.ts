import { Injectable } from "@nestjs/common";
import { ReportingQueryService } from "./reporting-query.service";

export const REPORTING_TOOL_NAMES = [
  "daily_sales",
  "product_performance",
  "seller_performance",
  "seller_products",
  "specialist_directory",
  "order_summary",
  "payout_summary",
  "payment_health",
  "payment_refund_summary",
  "fulfillment_health",
  "bridge_connection_health",
  "blog_summary",
  "coupon_summary",
  "user_role_summary"
] as const;
export type ReportingToolName = (typeof REPORTING_TOOL_NAMES)[number];
export type ReportingToolInput = { days?: number; status?: string; sellerId?: string };

export const REPORTING_TOOL_DESCRIPTIONS: Record<ReportingToolName, string> = {
  daily_sales: "Aggregated sales by day, currency, and order status.",
  product_performance: "Products that appeared in orders, with sales and cancellation totals.",
  seller_performance: "Seller (also called specialist/expert/کارشناس/فروشنده) shops and sales totals.",
  seller_products: "A seller's actual catalog/listings and offers, including products with zero orders. Filter with sellerId when known.",
  specialist_directory: "Published specialist/expert directory without phone numbers or private contact data.",
  order_summary: "Masked order and item details without buyer identity. Supports days, status, and sellerId.",
  payout_summary: "Aggregated payout values by currency and status.",
  payment_health: "Aggregated payment attempts by day, provider, currency, and status.",
  payment_refund_summary: "Aggregated refunds by day, provider, currency, and status.",
  fulfillment_health: "Aggregated bridge fulfillment outcomes by day, mode, and status.",
  bridge_connection_health: "Bridge connection operational status without URLs or credentials.",
  blog_summary: "Blog post metadata and publishing status without draft body content.",
  coupon_summary: "Coupon usage and validity statistics without coupon codes.",
  user_role_summary: "User counts by role; never returns names, email addresses, phones, or credentials."
};

@Injectable()
export class ReportingToolsService {
  constructor(private readonly queries: ReportingQueryService) {}
  async execute(name: ReportingToolName, rawInput: ReportingToolInput = {}) {
    const input = this.input(rawInput);
    const clauses: string[] = [];
    const parameters: unknown[] = [];
    if (input.days && ["daily_sales", "order_summary", "payment_health", "payment_refund_summary", "fulfillment_health"].includes(name)) { parameters.push(input.days); clauses.push(`day >= CURRENT_DATE - ($${parameters.length} * INTERVAL '1 day')`); }
    if (input.status && ["daily_sales", "order_summary", "payout_summary", "payment_health", "payment_refund_summary", "fulfillment_health", "blog_summary"].includes(name)) { parameters.push(input.status); clauses.push(`status = $${parameters.length}`); }
    if (input.sellerId && ["seller_products", "order_summary", "bridge_connection_health", "blog_summary", "coupon_summary"].includes(name)) { parameters.push(input.sellerId); clauses.push(`seller_id = $${parameters.length}`); }
    const sql = `SELECT * FROM ai_reporting.${name}${clauses.length ? ` WHERE ${clauses.join(" AND ")}` : ""} ORDER BY 1 ASC`;
    return this.queries.execute(this.queries.validate(sql), parameters);
  }

  private input(value: ReportingToolInput): ReportingToolInput { return { ...(Number.isInteger(value.days) ? { days: Math.min(Math.max(value.days!, 1), 365) } : {}), ...(typeof value.status === "string" && /^[a-z_ -]{1,32}$/i.test(value.status) ? { status: value.status } : {}), ...(typeof value.sellerId === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value.sellerId) ? { sellerId: value.sellerId } : {}) }; }
}
