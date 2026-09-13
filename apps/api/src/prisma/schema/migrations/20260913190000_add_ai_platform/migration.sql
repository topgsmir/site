CREATE TYPE "ai_provider" AS ENUM ('openai', 'anthropic');
CREATE TYPE "ai_profile_status" AS ENUM ('inactive', 'active', 'error');
CREATE TYPE "ai_message_role" AS ENUM ('user', 'assistant');
CREATE TYPE "ai_run_status" AS ENUM ('running', 'awaiting_approval', 'completed', 'failed', 'rejected');
CREATE TYPE "ai_tool_kind" AS ENUM ('tool', 'sql');
CREATE TYPE "ai_tool_status" AS ENUM ('proposed', 'running', 'completed', 'failed', 'rejected');

CREATE TABLE "ai_model_profiles" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" VARCHAR(100) NOT NULL,
  "provider" "ai_provider" NOT NULL,
  "model_id" VARCHAR(200) NOT NULL,
  "base_url" VARCHAR(500) NOT NULL,
  "encrypted_api_key" TEXT NOT NULL,
  "encryption_key_id" VARCHAR(32) NOT NULL,
  "api_key_hint" VARCHAR(8) NOT NULL,
  "status" "ai_profile_status" NOT NULL DEFAULT 'inactive',
  "last_tested_at" TIMESTAMPTZ,
  "last_error_code" VARCHAR(64),
  "created_by_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_profiles_name_check" CHECK (CHAR_LENGTH(BTRIM("name")) BETWEEN 1 AND 100),
  CONSTRAINT "ai_profiles_model_check" CHECK (CHAR_LENGTH(BTRIM("model_id")) BETWEEN 1 AND 200),
  CONSTRAINT "ai_profiles_hint_check" CHECK (CHAR_LENGTH("api_key_hint") BETWEEN 1 AND 8)
);
CREATE UNIQUE INDEX "ai_model_profiles_name_normalized_key" ON "ai_model_profiles" (LOWER(BTRIM("name")));
CREATE INDEX "ai_model_profiles_status_updated_idx" ON "ai_model_profiles" ("status", "updated_at" DESC, "id" DESC);

CREATE TABLE "ai_capabilities" (
  "key" VARCHAR(64) PRIMARY KEY,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_capabilities_key_check" CHECK ("key" ~ '^[a-z][a-z0-9_]{2,63}$')
);
INSERT INTO "ai_capabilities" ("key") VALUES ('database_assistant');

CREATE TABLE "ai_capability_bindings" (
  "capability_key" VARCHAR(64) PRIMARY KEY REFERENCES "ai_capabilities"("key") ON DELETE CASCADE ON UPDATE CASCADE,
  "profile_id" TEXT NOT NULL REFERENCES "ai_model_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "updated_by_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX "ai_capability_bindings_profile_idx" ON "ai_capability_bindings" ("profile_id");

CREATE TABLE "ai_conversations" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "capability_key" VARCHAR(64) NOT NULL REFERENCES "ai_capabilities"("key") ON DELETE RESTRICT ON UPDATE CASCADE,
  "owner_user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "title" VARCHAR(160) NOT NULL,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "deleted_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_conversations_title_check" CHECK (CHAR_LENGTH(BTRIM("title")) BETWEEN 1 AND 160)
);
CREATE INDEX "ai_conversations_owner_activity_idx" ON "ai_conversations" ("owner_user_id", "deleted_at", "updated_at" DESC, "id" DESC);
CREATE INDEX "ai_conversations_expiry_idx" ON "ai_conversations" ("expires_at");

CREATE TABLE "ai_messages" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "conversation_id" TEXT NOT NULL REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "role" "ai_message_role" NOT NULL,
  "content" TEXT NOT NULL,
  "structured_content" JSONB,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_messages_content_check" CHECK (CHAR_LENGTH("content") BETWEEN 1 AND 30000)
);
CREATE INDEX "ai_messages_conversation_created_idx" ON "ai_messages" ("conversation_id", "created_at", "id");
CREATE INDEX "ai_messages_expiry_idx" ON "ai_messages" ("expires_at");

CREATE TABLE "ai_runs" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "conversation_id" TEXT NOT NULL REFERENCES "ai_conversations"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "requester_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "profile_id" TEXT NOT NULL REFERENCES "ai_model_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "input_message_id" TEXT NOT NULL UNIQUE REFERENCES "ai_messages"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "output_message_id" TEXT UNIQUE REFERENCES "ai_messages"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "status" "ai_run_status" NOT NULL DEFAULT 'running',
  "provider_request_id" VARCHAR(200),
  "input_tokens" INTEGER,
  "output_tokens" INTEGER,
  "duration_ms" INTEGER,
  "error_code" VARCHAR(64),
  "expires_at" TIMESTAMPTZ NOT NULL,
  "started_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMPTZ,
  CONSTRAINT "ai_runs_counts_check" CHECK (
    ("input_tokens" IS NULL OR "input_tokens" >= 0) AND
    ("output_tokens" IS NULL OR "output_tokens" >= 0) AND
    ("duration_ms" IS NULL OR "duration_ms" >= 0)
  )
);
CREATE INDEX "ai_runs_conversation_started_idx" ON "ai_runs" ("conversation_id", "started_at" DESC, "id" DESC);
CREATE INDEX "ai_runs_status_started_idx" ON "ai_runs" ("status", "started_at");
CREATE INDEX "ai_runs_expiry_idx" ON "ai_runs" ("expires_at");

CREATE TABLE "ai_tool_executions" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "run_id" TEXT NOT NULL REFERENCES "ai_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  "name" VARCHAR(64) NOT NULL,
  "kind" "ai_tool_kind" NOT NULL,
  "status" "ai_tool_status" NOT NULL,
  "input" JSONB NOT NULL,
  "result" JSONB,
  "sql_text" TEXT,
  "sql_hash" CHAR(64),
  "row_count" INTEGER,
  "duration_ms" INTEGER,
  "approved_by_id" TEXT REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "approved_at" TIMESTAMPTZ,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at" TIMESTAMPTZ,
  CONSTRAINT "ai_tools_name_check" CHECK ("name" ~ '^[a-z][a-z0-9_]{1,63}$'),
  CONSTRAINT "ai_tools_counts_check" CHECK (("row_count" IS NULL OR "row_count" >= 0) AND ("duration_ms" IS NULL OR "duration_ms" >= 0)),
  CONSTRAINT "ai_tools_sql_shape_check" CHECK (
    ("kind" = 'sql' AND "sql_text" IS NOT NULL AND "sql_hash" IS NOT NULL) OR
    ("kind" = 'tool' AND "sql_text" IS NULL AND "sql_hash" IS NULL)
  ),
  CONSTRAINT "ai_tools_approval_check" CHECK (("approved_by_id" IS NULL) = ("approved_at" IS NULL))
);
CREATE INDEX "ai_tools_run_created_idx" ON "ai_tool_executions" ("run_id", "created_at", "id");
CREATE INDEX "ai_tools_status_created_idx" ON "ai_tool_executions" ("status", "created_at");
CREATE INDEX "ai_tools_expiry_idx" ON "ai_tool_executions" ("expires_at");

CREATE TABLE "ai_audit_events" (
  "id" TEXT PRIMARY KEY DEFAULT gen_random_uuid(),
  "actor_user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  "capability_key" VARCHAR(64) NOT NULL REFERENCES "ai_capabilities"("key") ON DELETE RESTRICT ON UPDATE CASCADE,
  "profile_id" TEXT REFERENCES "ai_model_profiles"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "conversation_id" TEXT REFERENCES "ai_conversations"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "run_id" TEXT REFERENCES "ai_runs"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  "event_type" VARCHAR(64) NOT NULL,
  "metadata" JSONB NOT NULL,
  "expires_at" TIMESTAMPTZ NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ai_audit_event_check" CHECK ("event_type" ~ '^[a-z][a-z0-9_]{1,63}$')
);
CREATE INDEX "ai_audit_actor_created_idx" ON "ai_audit_events" ("actor_user_id", "created_at" DESC, "id" DESC);
CREATE INDEX "ai_audit_run_idx" ON "ai_audit_events" ("run_id");
CREATE INDEX "ai_audit_expiry_idx" ON "ai_audit_events" ("expires_at");

CREATE SCHEMA "ai_reporting";
REVOKE ALL ON SCHEMA "ai_reporting" FROM PUBLIC;

CREATE VIEW "ai_reporting"."daily_sales" AS
SELECT DATE_TRUNC('day', o."created_at")::date AS "day", o."currency", o."status"::text AS "status",
       COUNT(*)::bigint AS "order_count", COALESCE(SUM(o."total_amount"), 0)::numeric(20,4) AS "gross_amount"
FROM "orders" o GROUP BY 1, 2, 3;

CREATE VIEW "ai_reporting"."product_performance" AS
SELECT oi."offer_id", oi."product_title", oi."product_type"::text AS "product_type", o."currency",
       COUNT(*)::bigint AS "order_count", COALESCE(SUM(oi."quantity"), 0)::bigint AS "units",
       COALESCE(SUM(oi."total_amount"), 0)::numeric(20,4) AS "gross_amount",
       COUNT(*) FILTER (WHERE o."status" = 'cancelled')::bigint AS "cancelled_orders"
FROM "order_items" oi JOIN "orders" o ON o."id" = oi."order_id"
GROUP BY 1, 2, 3, 4;

CREATE VIEW "ai_reporting"."seller_performance" AS
SELECT s."id" AS "seller_id", s."shop_name", s."approved", (s."suspended_at" IS NOT NULL) AS "suspended",
       o."currency", COUNT(o."id")::bigint AS "order_count",
       COALESCE(SUM(o."total_amount"), 0)::numeric(20,4) AS "gross_amount",
       COUNT(o."id") FILTER (WHERE o."status" = 'cancelled')::bigint AS "cancelled_orders"
FROM "sellers" s LEFT JOIN "orders" o ON o."seller_id" = s."id"
GROUP BY 1, 2, 3, 4, 5;

CREATE VIEW "ai_reporting"."payout_summary" AS
SELECT p."currency", p."status"::text AS "status", COUNT(*)::bigint AS "payout_count",
       COALESCE(SUM(p."gross_amount"), 0)::numeric(20,4) AS "gross_amount",
       COALESCE(SUM(p."commission_amount"), 0)::numeric(20,4) AS "commission_amount",
       COALESCE(SUM(p."payable_amount"), 0)::numeric(20,4) AS "payable_amount"
FROM "payout_ledger" p GROUP BY 1, 2;

CREATE VIEW "ai_reporting"."payment_health" AS
SELECT DATE_TRUNC('day', p."created_at")::date AS "day", p."provider", p."status"::text AS "status", p."currency",
       COUNT(*)::bigint AS "attempt_count", COALESCE(SUM(p."amount"), 0)::numeric(20,4) AS "amount"
FROM "payment_attempts" p GROUP BY 1, 2, 3, 4;

CREATE VIEW "ai_reporting"."fulfillment_health" AS
SELECT DATE_TRUNC('day', f."created_at")::date AS "day", f."mode"::text AS "mode", f."status"::text AS "status",
       COUNT(*)::bigint AS "fulfillment_count", COALESCE(AVG(f."submit_attempts"), 0)::numeric(10,2) AS "average_submit_attempts"
FROM "bridge_fulfillments" f GROUP BY 1, 2, 3;

REVOKE ALL ON ALL TABLES IN SCHEMA "ai_reporting" FROM PUBLIC;

ALTER TABLE "auth_rate_limits"
  DROP CONSTRAINT "auth_rate_limits_action_check",
  ADD CONSTRAINT "auth_rate_limits_action_check" CHECK (
    "action" IN ('login','register','order','payout','media','otp','payment','payment_callback','payment_refund','staff_setup','bridge','signed_ticket','ai_profile','ai_run')
  );
