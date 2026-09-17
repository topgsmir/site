SET lock_timeout = '5s';
SET statement_timeout = '30s';

CREATE TABLE "usd_exchange_rate_settings" (
  "id" SMALLINT NOT NULL DEFAULT 1,
  "automation_enabled" BOOLEAN NOT NULL DEFAULT true,
  "rate_toman" NUMERIC(18,2),
  "rate_source" VARCHAR(16),
  "rate_updated_at" TIMESTAMPTZ(3),
  "last_run_status" VARCHAR(16) NOT NULL DEFAULT 'never',
  "last_attempt_at" TIMESTAMPTZ(3),
  "last_success_at" TIMESTAMPTZ(3),
  "last_failure_at" TIMESTAMPTZ(3),
  "last_error_code" VARCHAR(64),
  "next_run_at" TIMESTAMPTZ(3),
  "run_token" UUID,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "usd_exchange_rate_settings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "usd_exchange_rate_settings_singleton_check" CHECK ("id" = 1),
  CONSTRAINT "usd_exchange_rate_settings_rate_check" CHECK ("rate_toman" IS NULL OR "rate_toman" BETWEEN 10000 AND 10000000),
  CONSTRAINT "usd_exchange_rate_settings_source_check" CHECK ("rate_source" IS NULL OR "rate_source" IN ('alanchand', 'manual')),
  CONSTRAINT "usd_exchange_rate_settings_status_check" CHECK ("last_run_status" IN ('never', 'running', 'success', 'failed', 'cancelled')),
  CONSTRAINT "usd_exchange_rate_settings_run_check" CHECK ("run_token" IS NULL OR "last_run_status" = 'running')
);

INSERT INTO "usd_exchange_rate_settings" ("id", "automation_enabled", "next_run_at")
VALUES (1, true, CURRENT_TIMESTAMP);

CREATE TABLE "usd_exchange_rate_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "settings_id" SMALLINT NOT NULL,
  "actor_user_id" TEXT,
  "event_type" VARCHAR(32) NOT NULL,
  "rate_toman" NUMERIC(18,2),
  "automation_enabled" BOOLEAN NOT NULL,
  "error_code" VARCHAR(64),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "usd_exchange_rate_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "usd_exchange_rate_events_type_check" CHECK ("event_type" IN ('automatic_refresh', 'manual_override', 'automation_changed')),
  CONSTRAINT "usd_exchange_rate_events_rate_check" CHECK ("rate_toman" IS NULL OR "rate_toman" BETWEEN 10000 AND 10000000),
  CONSTRAINT "usd_exchange_rate_events_settings_id_fkey" FOREIGN KEY ("settings_id") REFERENCES "usd_exchange_rate_settings"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "usd_exchange_rate_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "usd_exchange_rate_events_settings_id_created_at_id_idx"
  ON "usd_exchange_rate_events"("settings_id", "created_at" DESC, "id" DESC);
CREATE INDEX "usd_exchange_rate_events_actor_user_id_created_at_id_idx"
  ON "usd_exchange_rate_events"("actor_user_id", "created_at" DESC, "id" DESC);

RESET lock_timeout;
RESET statement_timeout;
