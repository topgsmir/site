ALTER TABLE "sms_settings"
  ADD COLUMN "test_mode_enabled" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "sms_setting_events"
  ADD COLUMN "test_mode_enabled" BOOLEAN NOT NULL DEFAULT false;
