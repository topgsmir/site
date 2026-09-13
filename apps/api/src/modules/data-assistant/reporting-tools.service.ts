import { Injectable } from "@nestjs/common";
import { ReportingQueryService } from "./reporting-query.service";

export const REPORTING_TOOL_NAMES = ["daily_sales", "product_performance", "seller_performance", "payout_summary", "payment_health", "fulfillment_health"] as const;
export type ReportingToolName = (typeof REPORTING_TOOL_NAMES)[number];
export type ReportingToolInput = { days?: number; status?: string };

@Injectable()
export class ReportingToolsService {
  constructor(private readonly queries: ReportingQueryService) {}
  async execute(name: ReportingToolName, rawInput: ReportingToolInput = {}) {
    const input = this.input(rawInput);
    const clauses: string[] = [];
    const parameters: unknown[] = [];
    if (input.days && ["daily_sales", "payment_health", "fulfillment_health"].includes(name)) { parameters.push(input.days); clauses.push(`day >= CURRENT_DATE - ($${parameters.length} * INTERVAL '1 day')`); }
    if (input.status && !["product_performance", "seller_performance"].includes(name)) { parameters.push(input.status); clauses.push(`status = $${parameters.length}`); }
    const sql = `SELECT * FROM ai_reporting.${name}${clauses.length ? ` WHERE ${clauses.join(" AND ")}` : ""} ORDER BY 1 ASC`;
    return this.queries.execute(this.queries.validate(sql), parameters);
  }

  private input(value: ReportingToolInput): ReportingToolInput { return { ...(Number.isInteger(value.days) ? { days: Math.min(Math.max(value.days!, 1), 365) } : {}), ...(typeof value.status === "string" && /^[a-z_ -]{1,32}$/i.test(value.status) ? { status: value.status } : {}) }; }
}
