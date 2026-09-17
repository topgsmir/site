ALTER TABLE "usd_exchange_rate_settings"
  DROP CONSTRAINT "usd_exchange_rate_settings_source_check",
  DROP CONSTRAINT "usd_exchange_rate_settings_provider_check",
  ADD CONSTRAINT "usd_exchange_rate_settings_source_check"
    CHECK ("rate_source" IS NULL OR "rate_source" IN ('alanchand', 'nobitex', 'tgju', 'manual')) NOT VALID,
  ADD CONSTRAINT "usd_exchange_rate_settings_provider_check"
    CHECK ("selected_provider" IN ('alanchand', 'nobitex', 'tgju')) NOT VALID;

ALTER TABLE "usd_exchange_rate_settings"
  VALIDATE CONSTRAINT "usd_exchange_rate_settings_source_check";
ALTER TABLE "usd_exchange_rate_settings"
  VALIDATE CONSTRAINT "usd_exchange_rate_settings_provider_check";

ALTER TABLE "usd_exchange_rate_events"
  DROP CONSTRAINT "usd_exchange_rate_events_provider_check",
  ADD CONSTRAINT "usd_exchange_rate_events_provider_check"
    CHECK ("selected_provider" IS NULL OR "selected_provider" IN ('alanchand', 'nobitex', 'tgju')) NOT VALID;

ALTER TABLE "usd_exchange_rate_events"
  VALIDATE CONSTRAINT "usd_exchange_rate_events_provider_check";
