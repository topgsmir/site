SET lock_timeout = '5s';
SET statement_timeout = '30s';

ALTER TYPE "seller_permission" ADD VALUE IF NOT EXISTS 'physical_products_manage';

CREATE TABLE "seller_shipping_profiles" (
    "seller_id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "sender_name" VARCHAR(200) NOT NULL,
    "sender_mobile" VARCHAR(16) NOT NULL,
    "province" VARCHAR(100) NOT NULL,
    "city" VARCHAR(100) NOT NULL,
    "address_line" VARCHAR(500) NOT NULL,
    "postal_code" CHAR(10) NOT NULL,
    "updated_by_user_id" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seller_shipping_profiles_pkey" PRIMARY KEY ("seller_id"),
    CONSTRAINT "seller_shipping_profiles_sender_name_check" CHECK (char_length(btrim("sender_name")) BETWEEN 2 AND 200),
    CONSTRAINT "seller_shipping_profiles_sender_mobile_check" CHECK ("sender_mobile" ~ '^09[0-9]{9}$'),
    CONSTRAINT "seller_shipping_profiles_province_check" CHECK (char_length(btrim("province")) BETWEEN 2 AND 100),
    CONSTRAINT "seller_shipping_profiles_city_check" CHECK (char_length(btrim("city")) BETWEEN 2 AND 100),
    CONSTRAINT "seller_shipping_profiles_address_check" CHECK (char_length(btrim("address_line")) BETWEEN 5 AND 500),
    CONSTRAINT "seller_shipping_profiles_postal_code_check" CHECK ("postal_code" ~ '^[0-9]{10}$')
);

CREATE TABLE "seller_shipping_profile_events" (
    "id" TEXT NOT NULL,
    "seller_id" TEXT NOT NULL,
    "actor_user_id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL,
    "changed_fields" JSONB NOT NULL,
    "changed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seller_shipping_profile_events_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "seller_shipping_profiles"
  ADD CONSTRAINT "seller_shipping_profiles_seller_id_fkey"
  FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE NOT VALID;
ALTER TABLE "seller_shipping_profiles" VALIDATE CONSTRAINT "seller_shipping_profiles_seller_id_fkey";

ALTER TABLE "seller_shipping_profiles"
  ADD CONSTRAINT "seller_shipping_profiles_updated_by_user_id_fkey"
  FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
ALTER TABLE "seller_shipping_profiles" VALIDATE CONSTRAINT "seller_shipping_profiles_updated_by_user_id_fkey";

ALTER TABLE "seller_shipping_profile_events"
  ADD CONSTRAINT "seller_shipping_profile_events_seller_id_fkey"
  FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE NOT VALID;
ALTER TABLE "seller_shipping_profile_events" VALIDATE CONSTRAINT "seller_shipping_profile_events_seller_id_fkey";

ALTER TABLE "seller_shipping_profile_events"
  ADD CONSTRAINT "seller_shipping_profile_events_actor_user_id_fkey"
  FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
ALTER TABLE "seller_shipping_profile_events" VALIDATE CONSTRAINT "seller_shipping_profile_events_actor_user_id_fkey";

CREATE INDEX "seller_shipping_profiles_enabled_updated_at_seller_id_idx"
  ON "seller_shipping_profiles"("enabled", "updated_at" DESC, "seller_id");
CREATE INDEX "seller_shipping_profiles_updated_by_user_id_idx"
  ON "seller_shipping_profiles"("updated_by_user_id");
CREATE INDEX "seller_shipping_profile_events_seller_id_changed_at_id_idx"
  ON "seller_shipping_profile_events"("seller_id", "changed_at" DESC, "id" DESC);
CREATE INDEX "seller_shipping_profile_events_actor_user_id_changed_at_id_idx"
  ON "seller_shipping_profile_events"("actor_user_id", "changed_at" DESC, "id" DESC);

RESET lock_timeout;
RESET statement_timeout;
