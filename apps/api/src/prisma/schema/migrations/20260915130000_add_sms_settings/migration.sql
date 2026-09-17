CREATE TABLE "sms_settings" (
  "id" SMALLINT NOT NULL DEFAULT 1,
  "otp_enabled" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sms_settings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sms_settings_singleton_check" CHECK ("id" = 1)
);

INSERT INTO "sms_settings" ("id", "otp_enabled") VALUES (1, true);

CREATE TABLE "sms_setting_events" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "settings_id" SMALLINT NOT NULL,
  "actor_user_id" TEXT NOT NULL,
  "otp_enabled" BOOLEAN NOT NULL,
  "changed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sms_setting_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sms_setting_events_settings_id_fkey"
    FOREIGN KEY ("settings_id") REFERENCES "sms_settings"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "sms_setting_events_actor_user_id_fkey"
    FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "sms_setting_events_settings_id_changed_at_id_idx"
  ON "sms_setting_events"("settings_id", "changed_at" DESC, "id" DESC);

CREATE INDEX "sms_setting_events_actor_user_id_changed_at_id_idx"
  ON "sms_setting_events"("actor_user_id", "changed_at" DESC, "id" DESC);
