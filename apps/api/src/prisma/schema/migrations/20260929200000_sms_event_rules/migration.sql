ALTER TABLE "sms_deliveries"
  ADD COLUMN "event_key" VARCHAR(64),
  ADD COLUMN "template_id" INTEGER,
  ADD COLUMN "message_text" TEXT;
ALTER TABLE "sms_deliveries" ADD COLUMN "test_mode" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE "sms_settings" ADD COLUMN "line_number" VARCHAR(24);
ALTER TABLE "sms_settings" ADD COLUMN "pending_check_minutes" INTEGER NOT NULL DEFAULT 10;
ALTER TABLE "sms_settings" ADD CONSTRAINT "sms_settings_pending_check_minutes_check" CHECK ("pending_check_minutes" BETWEEN 1 AND 1440);
ALTER TABLE "sms_setting_events" ADD COLUMN "line_number" VARCHAR(24);
ALTER TABLE "sms_setting_events" ADD COLUMN "pending_check_minutes" INTEGER NOT NULL DEFAULT 10;

CREATE INDEX "sms_deliveries_event_key_created_at_id_idx"
  ON "sms_deliveries" ("event_key", "created_at" DESC, "id" DESC);

CREATE TABLE "sms_event_rules" (
  "id" UUID NOT NULL,
  "event_key" VARCHAR(64) NOT NULL,
  "product_type" VARCHAR(16) NOT NULL DEFAULT 'any',
  "recipient_kind" VARCHAR(16) NOT NULL,
  "recipient_role" VARCHAR(32),
  "phone_number" VARCHAR(16),
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "template_id" INTEGER,
  "message_text" TEXT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sms_event_rules_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sms_event_rules_event_check" CHECK ("event_key" IN ('login_otp', 'guest_comment_verification', 'pending_product', 'product_sold', 'physical_order_shipped', 'search_empty', 'bridge_success', 'bridge_failure')),
  CONSTRAINT "sms_event_rules_product_type_check" CHECK ("product_type" IN ('any', 'digital', 'physical', 'service', 'bridge')),
  CONSTRAINT "sms_event_rules_recipient_check" CHECK (
    ("recipient_kind" = 'phone' AND "phone_number" ~ '^[+]989[0-9]{9}$' AND "recipient_role" IS NULL) OR
    ("recipient_kind" = 'role' AND "recipient_role" IN ('platform_admin', 'platform_staff', 'seller_admin', 'seller_staff', 'buyer') AND "phone_number" IS NULL) OR
    ("recipient_kind" IN ('buyer', 'seller', 'requester', 'all') AND "recipient_role" IS NULL AND "phone_number" IS NULL)
  ),
  CONSTRAINT "sms_event_rules_content_check" CHECK (
    "template_id" IS NULL OR "template_id" > 0
  ),
  CONSTRAINT "sms_event_rules_message_length_check" CHECK (
    "message_text" IS NULL OR length("message_text") BETWEEN 1 AND 1000
  ),
  CONSTRAINT "sms_event_rules_code_target_check" CHECK (
    "event_key" NOT IN ('login_otp', 'guest_comment_verification') OR ("recipient_kind" = 'requester' AND "product_type" = 'any' AND "message_text" IS NULL)
  )
);

CREATE INDEX "sms_event_rules_event_key_product_type_enabled_idx"
  ON "sms_event_rules" ("event_key", "product_type", "enabled");
CREATE UNIQUE INDEX "sms_event_rules_target_unique"
  ON "sms_event_rules" ("event_key", "product_type", "recipient_kind", COALESCE("recipient_role", ''), COALESCE("phone_number", ''));

CREATE TABLE "sms_rule_events" (
  "id" UUID NOT NULL,
  "rule_id" UUID NOT NULL,
  "actor_user_id" TEXT NOT NULL,
  "action" VARCHAR(16) NOT NULL,
  "event_key" VARCHAR(64) NOT NULL,
  "enabled" BOOLEAN NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sms_rule_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sms_rule_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "sms_rule_events_action_check" CHECK ("action" IN ('create', 'update', 'delete'))
);
CREATE INDEX "sms_rule_events_rule_id_created_at_idx" ON "sms_rule_events" ("rule_id", "created_at" DESC);
CREATE INDEX "sms_rule_events_actor_user_id_created_at_idx" ON "sms_rule_events" ("actor_user_id", "created_at" DESC);

INSERT INTO "sms_event_rules" ("id", "event_key", "recipient_kind", "recipient_role", "enabled") VALUES
  (gen_random_uuid(), 'login_otp', 'requester', NULL, true),
  (gen_random_uuid(), 'guest_comment_verification', 'requester', NULL, false),
  (gen_random_uuid(), 'pending_product', 'role', 'platform_admin', false),
  (gen_random_uuid(), 'product_sold', 'seller', NULL, true),
  (gen_random_uuid(), 'physical_order_shipped', 'buyer', NULL, false),
  (gen_random_uuid(), 'search_empty', 'role', 'platform_admin', false),
  (gen_random_uuid(), 'bridge_success', 'buyer', NULL, true),
  (gen_random_uuid(), 'bridge_failure', 'buyer', NULL, true);

CREATE TABLE "sms_guest_challenges" (
  "id" UUID NOT NULL,
  "phone" VARCHAR(16) NOT NULL,
  "code_hash" CHAR(64) NOT NULL,
  "status" VARCHAR(16) NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "expires_at" TIMESTAMPTZ(3) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "sms_guest_challenges_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "sms_guest_challenges_status_check" CHECK ("status" IN ('pending', 'consumed')),
  CONSTRAINT "sms_guest_challenges_attempts_check" CHECK ("attempts" BETWEEN 0 AND 5)
);
CREATE INDEX "sms_guest_challenges_phone_status_created_at_idx" ON "sms_guest_challenges" ("phone", "status", "created_at" DESC);
CREATE INDEX "sms_guest_challenges_expires_at_idx" ON "sms_guest_challenges" ("expires_at");
