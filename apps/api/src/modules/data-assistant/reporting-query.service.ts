import { BadRequestException, Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { astVisitor, parse } from "pgsql-ast-parser";
import { Pool, type QueryResultRow } from "pg";

const VIEWS = new Set(["daily_sales", "product_performance", "seller_performance", "seller_products", "specialist_directory", "order_summary", "payout_summary", "payment_health", "payment_refund_summary", "fulfillment_health", "bridge_connection_health", "blog_summary", "coupon_summary", "user_role_summary"]);
const FUNCTIONS = new Set(["count", "sum", "avg", "min", "max", "date_trunc", "coalesce", "round", "nullif"]);
const COLUMNS = new Set(["day", "currency", "status", "order_id", "order_count", "gross_amount", "total_amount", "unit_price", "quantity", "offer_id", "listing_id", "product_id", "product_title", "product_type", "product_kind", "product_status", "listing_status", "offer_status", "category", "variant_name", "price", "stock", "service_type", "estimated_hours", "units", "cancelled_orders", "seller_id", "shop_name", "approved", "suspended", "specialist_id", "name", "specialty", "rating", "available", "payout_count", "commission_amount", "payable_amount", "provider", "attempt_count", "refund_count", "amount", "mode", "fulfillment_count", "average_submit_attempts", "connection_id", "connection_name", "last_tested_at", "last_synced_at", "last_error_code", "post_id", "title", "published_at", "coupon_count", "redeemed_count", "active", "starts_at", "expires_at", "role", "user_count", "created_at"]);
const OPERATORS = new Set(["OR", "AND", "IN", "NOT IN", "LIKE", "NOT LIKE", "ILIKE", "NOT ILIKE", "=", "!=", ">", ">=", "<", "<=", "+", "-", "*", "/"]);

@Injectable()
export class ReportingQueryService implements OnModuleDestroy {
  private readonly pool: Pool;
  constructor(config: ConfigService) {
    const environment = config.get<string>("NODE_ENV") ?? "development";
    const connectionString = config.get<string>("AI_DATABASE_URL")?.trim() || (environment === "production" ? "" : config.get<string>("DATABASE_URL")?.trim());
    if (!connectionString) throw new Error("AI_DATABASE_URL is required in production");
    this.pool = new Pool({ connectionString, max: 3, connectionTimeoutMillis: 5_000, idleTimeoutMillis: 15_000 });
  }
  async onModuleDestroy() { await this.pool.end(); }

  validate(sql: string) {
    const normalized = sql.trim().replace(/;$/, "");
    if (normalized.length < 8 || normalized.length > 10_000 || /--|\/\*|\*\//.test(normalized) || normalized.includes(";")) throw new BadRequestException("Generated SQL contains unsupported syntax");
    let statements: ReturnType<typeof parse>;
    try { statements = parse(normalized); } catch { throw new BadRequestException("Generated SQL is not valid PostgreSQL"); }
    if (statements.length !== 1 || !["select", "with", "union", "union all"].includes(statements[0]!.type)) throw new BadRequestException("Only one SELECT statement is allowed");
    if (/\b(insert|update|delete|merge|copy|alter|create|drop|truncate|grant|revoke|call|do|lock|for\s+(update|share)|into)\b/i.test(normalized)) throw new BadRequestException("Generated SQL is not read-only");
    if (/\b(current_user|session_user|current_role|current_schema|current_catalog)\b/i.test(normalized)) throw new BadRequestException("Generated SQL contains an unsafe session reference");
    let ctes = new Set<string>();
    let reportingReferences = 0;
    const relationError = () => new BadRequestException("Generated SQL may only query approved reporting views and local read-only CTEs");
    const visitor = astVisitor((v) => ({
      statement: (node) => {
        if (!["select", "with", "union", "union all", "values"].includes(node.type)) throw new BadRequestException("Generated SQL is not read-only");
        v.super().statement(node);
      },
      with: (node) => {
        const outer = ctes;
        ctes = new Set(outer);
        const declared = new Set<string>();
        try {
          for (const binding of node.bind) {
            const name = binding.alias.name;
            if (declared.has(name)) throw relationError();
            // Non-recursive bindings see outer CTEs and earlier siblings, never
            // themselves or later siblings. Nested bindings stay in this scope.
            v.statement(binding.statement);
            declared.add(name);
            ctes.add(name);
          }
          v.statement(node.in);
        } finally { ctes = outer; }
      },
      withRecursive: () => { throw new BadRequestException("Recursive reporting queries are not allowed"); },
      tableRef: (node) => {
        // The parser folds unquoted identifiers; preserve quoted identifier case.
        // A schema-qualified reference can never resolve to a local CTE.
        if (node.schema === "ai_reporting" && VIEWS.has(node.name)) reportingReferences++;
        else if (node.schema || !ctes.has(node.name)) throw relationError();
      },
      fromCall: () => { throw relationError(); },
      selection: (node) => {
        if (node.for) throw new BadRequestException("Generated SQL is not read-only");
        v.super().selection(node);
        // DISTINCT ON expressions are also omitted by the default visitor.
        if (Array.isArray(node.distinct)) node.distinct.forEach((expression) => v.expr(expression));
      },
      ref: (node) => { if (node.name !== "*" && !COLUMNS.has(node.name.toLowerCase())) throw new BadRequestException(`SQL column '${node.name}' is not allowed`); v.super().ref(node); },
      call: (node) => {
        if (node.function.schema || !FUNCTIONS.has(node.function.name.toLowerCase())) throw new BadRequestException(`SQL function '${node.function.name}' is not allowed`);
        v.super().call(node);
        // pgsql-ast-parser's default visitor does not walk OVER expressions.
        node.over?.partitionBy?.forEach((expression) => v.expr(expression));
        node.over?.orderBy?.forEach((order) => v.expr(order.by));
      },
      binary: (node) => { if (node.opSchema || !OPERATORS.has(node.op)) throw new BadRequestException(`SQL operator '${node.op}' is not allowed`); v.super().binary(node); },
      member: () => { throw new BadRequestException("JSON and composite SQL operators are not allowed"); }
    }));
    visitor.statement(statements[0]);
    if (!reportingReferences) throw relationError();
    return normalized;
  }

  async execute(sql: string, parameters: unknown[] = []) {
    const client = await this.pool.connect();
    const started = Date.now();
    try {
      await client.query("BEGIN READ ONLY");
      await client.query("SET LOCAL statement_timeout = '5000ms'");
      await client.query("SET LOCAL lock_timeout = '500ms'");
      await client.query("SET LOCAL idle_in_transaction_session_timeout = '5000ms'");
      const result = await client.query<QueryResultRow>(`SELECT * FROM (${sql}) AS ai_result LIMIT 201`, parameters);
      await client.query("COMMIT");
      const truncated = result.rows.length > 200;
      return { rows: result.rows.slice(0, 200).map((row) => this.safeRow(row)), rowCount: Math.min(result.rows.length, 200), truncated, durationMs: Date.now() - started };
    } catch (error) { await client.query("ROLLBACK").catch(() => undefined); throw error; }
    finally { client.release(); }
  }

  private safeRow(row: QueryResultRow) {
    return Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value instanceof Date ? value.toISOString() : typeof value === "bigint" ? value.toString() : value]));
  }
}
