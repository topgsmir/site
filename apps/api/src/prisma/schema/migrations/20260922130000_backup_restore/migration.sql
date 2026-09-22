SET lock_timeout = '5s';
SET statement_timeout = '60s';

CREATE TABLE "backup_settings" (
  "id" SMALLINT NOT NULL DEFAULT 1,
  "automation_enabled" BOOLEAN NOT NULL DEFAULT false,
  "frequency" VARCHAR(16) NOT NULL DEFAULT 'daily',
  "weekdays" INTEGER[] NOT NULL DEFAULT '{}',
  "local_time" VARCHAR(5) NOT NULL DEFAULT '02:00',
  "timezone" VARCHAR(64) NOT NULL DEFAULT 'Asia/Tehran',
  "include_database" BOOLEAN NOT NULL DEFAULT true,
  "include_uploads" BOOLEAN NOT NULL DEFAULT true,
  "local_retention_count" SMALLINT NOT NULL DEFAULT 7,
  "next_run_at" TIMESTAMPTZ(3),
  "last_run_status" VARCHAR(16) NOT NULL DEFAULT 'never',
  "last_success_at" TIMESTAMPTZ(3),
  "last_failure_at" TIMESTAMPTZ(3),
  "run_token" UUID,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "backup_settings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "backup_settings_singleton_check" CHECK ("id" = 1),
  CONSTRAINT "backup_settings_frequency_check" CHECK ("frequency" IN ('daily','weekly')),
  CONSTRAINT "backup_settings_weekdays_check" CHECK ("weekdays" <@ ARRAY[0,1,2,3,4,5,6]),
  CONSTRAINT "backup_settings_time_check" CHECK ("local_time" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'),
  CONSTRAINT "backup_settings_components_check" CHECK ("include_database" OR "include_uploads"),
  CONSTRAINT "backup_settings_retention_check" CHECK ("local_retention_count" BETWEEN 1 AND 100),
  CONSTRAINT "backup_settings_status_check" CHECK ("last_run_status" IN ('never','queued','running','success','partial','failed'))
);
INSERT INTO "backup_settings" ("id") VALUES (1);

CREATE TABLE "backup_destinations" (
  "id" UUID NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "protocol" VARCHAR(8) NOT NULL,
  "host" VARCHAR(253) NOT NULL,
  "port" INTEGER NOT NULL,
  "username" VARCHAR(200) NOT NULL,
  "remote_path" VARCHAR(1000) NOT NULL,
  "retention_count" SMALLINT NOT NULL DEFAULT 30,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "host_key_fingerprint" VARCHAR(100),
  "allow_insecure" BOOLEAN NOT NULL DEFAULT false,
  "encrypted_password" TEXT,
  "encrypted_private_key" TEXT,
  "encrypted_key_passphrase" TEXT,
  "encryption_key_id" VARCHAR(32),
  "credential_hint" VARCHAR(8),
  "verified_at" TIMESTAMPTZ(3),
  "last_test_status" VARCHAR(16) NOT NULL DEFAULT 'never',
  "last_error_code" VARCHAR(64),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "backup_destinations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "backup_destinations_protocol_check" CHECK ("protocol" IN ('sftp','ftps','ftp')),
  CONSTRAINT "backup_destinations_port_check" CHECK ("port" BETWEEN 1 AND 65535),
  CONSTRAINT "backup_destinations_retention_check" CHECK ("retention_count" BETWEEN 1 AND 365),
  CONSTRAINT "backup_destinations_test_status_check" CHECK ("last_test_status" IN ('never','success','failed')),
  CONSTRAINT "backup_destinations_plain_ftp_check" CHECK ("protocol" <> 'ftp' OR "allow_insecure")
);

CREATE TABLE "backup_runs" (
  "id" UUID NOT NULL,
  "trigger" VARCHAR(16) NOT NULL,
  "status" VARCHAR(16) NOT NULL DEFAULT 'queued',
  "components" TEXT[] NOT NULL,
  "actor_user_id" TEXT,
  "archive_name" VARCHAR(255),
  "archive_path" TEXT,
  "archive_bytes" BIGINT,
  "archive_sha256" CHAR(64),
  "manifest" JSONB,
  "error_code" VARCHAR(64),
  "claim_token" UUID,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "started_at" TIMESTAMPTZ(3),
  "completed_at" TIMESTAMPTZ(3),
  CONSTRAINT "backup_runs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "backup_runs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "backup_runs_trigger_check" CHECK ("trigger" IN ('manual','scheduled','pre_restore')),
  CONSTRAINT "backup_runs_status_check" CHECK ("status" IN ('queued','running','success','partial','failed')),
  CONSTRAINT "backup_runs_components_check" CHECK (cardinality("components") BETWEEN 1 AND 2 AND "components" <@ ARRAY['database','uploads']::TEXT[]),
  CONSTRAINT "backup_runs_bytes_check" CHECK ("archive_bytes" IS NULL OR "archive_bytes" >= 0),
  CONSTRAINT "backup_runs_hash_check" CHECK ("archive_sha256" IS NULL OR "archive_sha256" ~ '^[0-9a-f]{64}$')
);

CREATE TABLE "backup_deliveries" (
  "id" UUID NOT NULL,
  "run_id" UUID NOT NULL,
  "destination_id" UUID,
  "destination_name" VARCHAR(100) NOT NULL,
  "protocol" VARCHAR(8) NOT NULL,
  "status" VARCHAR(16) NOT NULL DEFAULT 'pending',
  "remote_path" VARCHAR(1200),
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "error_code" VARCHAR(64),
  "next_attempt_at" TIMESTAMPTZ(3),
  "started_at" TIMESTAMPTZ(3),
  "completed_at" TIMESTAMPTZ(3),
  CONSTRAINT "backup_deliveries_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "backup_deliveries_run_id_fkey" FOREIGN KEY ("run_id") REFERENCES "backup_runs"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "backup_deliveries_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "backup_destinations"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "backup_deliveries_run_destination_key" UNIQUE ("run_id", "destination_id"),
  CONSTRAINT "backup_deliveries_protocol_check" CHECK ("protocol" IN ('sftp','ftps','ftp')),
  CONSTRAINT "backup_deliveries_status_check" CHECK ("status" IN ('pending','uploading','success','failed')),
  CONSTRAINT "backup_deliveries_attempts_check" CHECK ("attempts" BETWEEN 0 AND 3)
);

CREATE TABLE "backup_setting_events" (
  "id" UUID NOT NULL,
  "settings_id" SMALLINT NOT NULL DEFAULT 1,
  "actor_user_id" TEXT NOT NULL,
  "before_data" JSONB NOT NULL,
  "after_data" JSONB NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "backup_setting_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "backup_setting_events_settings_id_fkey" FOREIGN KEY ("settings_id") REFERENCES "backup_settings"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "backup_setting_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "backup_destination_events" (
  "id" UUID NOT NULL,
  "destination_id" UUID,
  "actor_user_id" TEXT NOT NULL,
  "action" VARCHAR(32) NOT NULL,
  "changed_fields" TEXT[] NOT NULL,
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "backup_destination_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "backup_destination_events_destination_id_fkey" FOREIGN KEY ("destination_id") REFERENCES "backup_destinations"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "backup_destination_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "backup_destination_events_action_check" CHECK ("action" IN ('created','updated','tested','enabled','disabled','deleted'))
);

CREATE TABLE "backup_restore_challenges" (
  "id" UUID NOT NULL,
  "actor_user_id" TEXT NOT NULL,
  "source_kind" VARCHAR(16) NOT NULL,
  "source_reference" VARCHAR(1200) NOT NULL,
  "staged_archive_path" TEXT NOT NULL,
  "manifest" JSONB NOT NULL,
  "phrase_hash" CHAR(64) NOT NULL,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "consumed_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "backup_restore_challenges_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "backup_restore_challenges_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "backup_restore_challenges_source_check" CHECK ("source_kind" IN ('catalog','upload','remote')),
  CONSTRAINT "backup_restore_challenges_phrase_hash_check" CHECK ("phrase_hash" ~ '^[0-9a-f]{64}$')
);

CREATE TABLE "backup_restore_events" (
  "id" UUID NOT NULL,
  "actor_user_id" TEXT,
  "archive_id" UUID,
  "status" VARCHAR(24) NOT NULL,
  "phase" VARCHAR(24) NOT NULL,
  "error_code" VARCHAR(64),
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "backup_restore_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "backup_restore_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "backup_restore_events_status_check" CHECK ("status" IN ('staged','ready','pending_restart','restoring','success','failed','recovery_required'))
);

CREATE TABLE "backup_restore_jobs" (
  "id" UUID NOT NULL,
  "actor_user_id" TEXT,
  "archive_id" UUID NOT NULL,
  "status" VARCHAR(24) NOT NULL,
  "phase" VARCHAR(24) NOT NULL,
  "error_code" VARCHAR(64),
  "requested_at" TIMESTAMPTZ(3) NOT NULL,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "backup_restore_jobs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "backup_restore_jobs_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "backup_restore_jobs_status_check" CHECK ("status" IN ('pending_restart','restoring','success','failed','recovery_required'))
);

CREATE INDEX "backup_destinations_enabled_protocol_updated_at_id_idx" ON "backup_destinations"("enabled", "protocol", "updated_at" DESC, "id" DESC);
CREATE INDEX "backup_runs_status_created_at_id_idx" ON "backup_runs"("status", "created_at", "id");
CREATE INDEX "backup_runs_created_at_id_idx" ON "backup_runs"("created_at" DESC, "id" DESC);
CREATE INDEX "backup_runs_actor_user_id_created_at_id_idx" ON "backup_runs"("actor_user_id", "created_at" DESC, "id" DESC);
CREATE INDEX "backup_deliveries_status_next_attempt_at_id_idx" ON "backup_deliveries"("status", "next_attempt_at", "id");
CREATE INDEX "backup_deliveries_destination_id_completed_at_id_idx" ON "backup_deliveries"("destination_id", "completed_at" DESC, "id" DESC);
CREATE INDEX "backup_setting_events_settings_id_created_at_id_idx" ON "backup_setting_events"("settings_id", "created_at" DESC, "id" DESC);
CREATE INDEX "backup_setting_events_actor_user_id_created_at_id_idx" ON "backup_setting_events"("actor_user_id", "created_at" DESC, "id" DESC);
CREATE INDEX "backup_destination_events_destination_id_created_at_id_idx" ON "backup_destination_events"("destination_id", "created_at" DESC, "id" DESC);
CREATE INDEX "backup_destination_events_actor_user_id_created_at_id_idx" ON "backup_destination_events"("actor_user_id", "created_at" DESC, "id" DESC);
CREATE INDEX "backup_restore_challenges_actor_user_id_expires_at_consumed_at_idx" ON "backup_restore_challenges"("actor_user_id", "expires_at", "consumed_at");
CREATE INDEX "backup_restore_events_created_at_id_idx" ON "backup_restore_events"("created_at" DESC, "id" DESC);
CREATE INDEX "backup_restore_events_actor_user_id_created_at_id_idx" ON "backup_restore_events"("actor_user_id", "created_at" DESC, "id" DESC);
CREATE INDEX "backup_restore_jobs_status_updated_at_id_idx" ON "backup_restore_jobs"("status", "updated_at" DESC, "id" DESC);
CREATE INDEX "backup_restore_jobs_actor_user_id_requested_at_id_idx" ON "backup_restore_jobs"("actor_user_id", "requested_at" DESC, "id" DESC);

ALTER TABLE "auth_rate_limits" ADD CONSTRAINT "auth_rate_limits_action_backup_check" CHECK (
  "action" IN ('login','register','order','shipping','shipping_configuration','payout','media','media_admin','otp','payment','payment_callback','payment_refund','payment_configuration','sms_configuration','staff_setup','bridge','signed_ticket','ai_profile','ai_profile_test','ai_run','product_bulk_undo','checkout_quote','analytics','auth_configuration','captcha_challenge','comment_submit','comment_reply','comment_admin','profile','goghdi_configuration','backup_admin','backup_restore')
) NOT VALID;
ALTER TABLE "auth_rate_limits" VALIDATE CONSTRAINT "auth_rate_limits_action_backup_check";
ALTER TABLE "auth_rate_limits" DROP CONSTRAINT "auth_rate_limits_action_check";
ALTER TABLE "auth_rate_limits" RENAME CONSTRAINT "auth_rate_limits_action_backup_check" TO "auth_rate_limits_action_check";

ALTER TABLE "security_policies" DROP CONSTRAINT "security_policies_action_check";
ALTER TABLE "security_policies" ADD CONSTRAINT "security_policies_action_check" CHECK (
  "action" IN ('login','register','otp','captcha_challenge','checkout_quote','comment_submit_guest','comment_submit','comment_reply','comment_admin','order','shipping','shipping_configuration','payout','media','media_admin','payment','payment_callback','payment_refund','payment_configuration','sms_configuration','goghdi_configuration','auth_configuration','staff_setup','bridge','signed_ticket','ai_profile','ai_profile_test','ai_run','product_bulk_undo','analytics','backup_admin','backup_restore')
);

RESET statement_timeout;
RESET lock_timeout;
