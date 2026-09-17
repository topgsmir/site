ALTER TABLE "usd_exchange_rate_settings"
  ADD COLUMN "selected_provider" VARCHAR(16) NOT NULL DEFAULT 'alanchand';

ALTER TABLE "usd_exchange_rate_settings"
  DROP CONSTRAINT "usd_exchange_rate_settings_source_check",
  ADD CONSTRAINT "usd_exchange_rate_settings_source_check"
    CHECK ("rate_source" IS NULL OR "rate_source" IN ('alanchand', 'nobitex', 'manual')) NOT VALID,
  ADD CONSTRAINT "usd_exchange_rate_settings_provider_check"
    CHECK ("selected_provider" IN ('alanchand', 'nobitex')) NOT VALID;

ALTER TABLE "usd_exchange_rate_settings"
  VALIDATE CONSTRAINT "usd_exchange_rate_settings_source_check";
ALTER TABLE "usd_exchange_rate_settings"
  VALIDATE CONSTRAINT "usd_exchange_rate_settings_provider_check";

ALTER TABLE "usd_exchange_rate_events"
  ADD COLUMN "selected_provider" VARCHAR(16),
  DROP CONSTRAINT "usd_exchange_rate_events_type_check",
  ADD CONSTRAINT "usd_exchange_rate_events_type_check"
    CHECK ("event_type" IN ('automatic_refresh', 'manual_override', 'automation_changed', 'provider_changed')) NOT VALID,
  ADD CONSTRAINT "usd_exchange_rate_events_provider_check"
    CHECK ("selected_provider" IS NULL OR "selected_provider" IN ('alanchand', 'nobitex')) NOT VALID;

ALTER TABLE "usd_exchange_rate_events"
  VALIDATE CONSTRAINT "usd_exchange_rate_events_type_check";
ALTER TABLE "usd_exchange_rate_events"
  VALIDATE CONSTRAINT "usd_exchange_rate_events_provider_check";
