SET lock_timeout = '5s';
SET statement_timeout = '60s';

ALTER TYPE "platform_permission" ADD VALUE IF NOT EXISTS 'uploads_manage';
CREATE TYPE "blog_media_usage" AS ENUM ('cover', 'inline');
CREATE TYPE "media_asset_source" AS ENUM ('blog', 'product');
CREATE TYPE "media_admin_action" AS ENUM ('trashed', 'auto_trashed', 'restored', 'purged', 'purge_failed');

ALTER TABLE "blog_media_assets"
  ADD COLUMN "original_filename" VARCHAR(255),
  ADD COLUMN "original_mime_type" VARCHAR(100),
  ADD COLUMN "trashed_at" TIMESTAMPTZ(3),
  ADD COLUMN "trashed_by_user_id" TEXT,
  ADD COLUMN "purge_after" TIMESTAMPTZ(3),
  ADD COLUMN "purging_at" TIMESTAMPTZ(3);

ALTER TABLE "product_media_assets"
  ADD COLUMN "restore_product_id" TEXT,
  ADD COLUMN "original_filename" VARCHAR(255),
  ADD COLUMN "original_mime_type" VARCHAR(100),
  ADD COLUMN "trashed_at" TIMESTAMPTZ(3),
  ADD COLUMN "trashed_by_user_id" TEXT,
  ADD COLUMN "purge_after" TIMESTAMPTZ(3),
  ADD COLUMN "purging_at" TIMESTAMPTZ(3),
  ALTER COLUMN "product_id" DROP NOT NULL;

ALTER TABLE "product_media_assets" DROP CONSTRAINT "product_media_assets_product_id_fkey";
ALTER TABLE "product_media_assets" ADD CONSTRAINT "product_media_assets_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "product_media_assets" ADD CONSTRAINT "product_media_assets_restore_product_id_fkey"
  FOREIGN KEY ("restore_product_id") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "blog_media_assets" ADD CONSTRAINT "blog_media_assets_trashed_by_user_id_fkey"
  FOREIGN KEY ("trashed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "product_media_assets" ADD CONSTRAINT "product_media_assets_trashed_by_user_id_fkey"
  FOREIGN KEY ("trashed_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "blog_media_assets" ADD CONSTRAINT "blog_media_assets_trash_lifecycle_check" CHECK (
  ("trashed_at" IS NULL AND "purge_after" IS NULL AND "purging_at" IS NULL AND "trashed_by_user_id" IS NULL)
  OR ("trashed_at" IS NOT NULL AND "purge_after" > "trashed_at")
) NOT VALID;
ALTER TABLE "product_media_assets" ADD CONSTRAINT "product_media_assets_trash_lifecycle_check" CHECK (
  ("trashed_at" IS NULL AND "purge_after" IS NULL AND "purging_at" IS NULL AND "trashed_by_user_id" IS NULL AND "restore_product_id" IS NULL)
  OR ("trashed_at" IS NOT NULL AND "product_id" IS NULL AND "purge_after" > "trashed_at")
) NOT VALID;
ALTER TABLE "blog_media_assets" VALIDATE CONSTRAINT "blog_media_assets_trash_lifecycle_check";
ALTER TABLE "product_media_assets" VALIDATE CONSTRAINT "product_media_assets_trash_lifecycle_check";

CREATE TABLE "blog_revision_media" (
  "revision_id" TEXT NOT NULL,
  "asset_id" TEXT NOT NULL,
  "usage" "blog_media_usage" NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "blog_revision_media_pkey" PRIMARY KEY ("revision_id", "asset_id", "usage"),
  CONSTRAINT "blog_revision_media_revision_id_fkey" FOREIGN KEY ("revision_id") REFERENCES "blog_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "blog_revision_media_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "blog_media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

INSERT INTO "blog_revision_media" ("revision_id", "asset_id", "usage")
SELECT "id", "cover_asset_id", 'cover'::"blog_media_usage"
FROM "blog_revisions" WHERE "cover_asset_id" IS NOT NULL
ON CONFLICT DO NOTHING;

INSERT INTO "blog_revision_media" ("revision_id", "asset_id", "usage")
SELECT DISTINCT t."revision_id", match[1], 'inline'::"blog_media_usage"
FROM "blog_revision_translations" t
CROSS JOIN LATERAL regexp_matches(t."content_json"::text, '/media/([0-9a-fA-F-]{36})/[a-z0-9-]+[.]webp', 'g') AS match
JOIN "blog_media_assets" a ON a."id" = match[1]
ON CONFLICT DO NOTHING;

CREATE TABLE "media_admin_events" (
  "id" UUID NOT NULL,
  "source" "media_asset_source" NOT NULL,
  "asset_id" UUID NOT NULL,
  "actor_user_id" TEXT,
  "action" "media_admin_action" NOT NULL,
  "reason" VARCHAR(500),
  "metadata" JSONB NOT NULL DEFAULT '{}',
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "media_admin_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "media_admin_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "blog_revision_media_asset_id_revision_id_idx" ON "blog_revision_media"("asset_id", "revision_id");
CREATE INDEX "blog_media_assets_trashed_at_created_at_id_idx" ON "blog_media_assets"("trashed_at", "created_at" DESC, "id" DESC);
CREATE INDEX "blog_media_assets_purge_after_purging_at_idx" ON "blog_media_assets"("purge_after", "purging_at");
CREATE INDEX "product_media_assets_restore_product_id_idx" ON "product_media_assets"("restore_product_id");
CREATE INDEX "product_media_assets_trashed_at_created_at_id_idx" ON "product_media_assets"("trashed_at", "created_at" DESC, "id" DESC);
CREATE INDEX "product_media_assets_purge_after_purging_at_idx" ON "product_media_assets"("purge_after", "purging_at");
CREATE INDEX "media_admin_events_source_asset_id_created_at_id_idx" ON "media_admin_events"("source", "asset_id", "created_at" DESC, "id" DESC);
CREATE INDEX "media_admin_events_actor_user_id_created_at_id_idx" ON "media_admin_events"("actor_user_id", "created_at" DESC, "id" DESC);

ALTER TABLE "auth_rate_limits" ADD CONSTRAINT "auth_rate_limits_action_media_admin_check" CHECK (
  "action" IN ('login','register','order','shipping','shipping_configuration','payout','media','media_admin','otp','payment','payment_callback','payment_refund','payment_configuration','sms_configuration','staff_setup','bridge','signed_ticket','ai_profile','ai_profile_test','ai_run','product_bulk_undo','checkout_quote','analytics','auth_configuration','captcha_challenge','comment_submit','comment_reply','comment_admin','profile','goghdi_configuration')
) NOT VALID;
ALTER TABLE "auth_rate_limits" VALIDATE CONSTRAINT "auth_rate_limits_action_media_admin_check";
ALTER TABLE "auth_rate_limits" DROP CONSTRAINT "auth_rate_limits_action_check";
ALTER TABLE "auth_rate_limits" RENAME CONSTRAINT "auth_rate_limits_action_media_admin_check" TO "auth_rate_limits_action_check";

ALTER TABLE "security_policies" DROP CONSTRAINT "security_policies_action_check";
ALTER TABLE "security_policies" ADD CONSTRAINT "security_policies_action_check" CHECK (
  "action" IN ('login','register','otp','captcha_challenge','checkout_quote','comment_submit_guest','comment_submit','comment_reply','comment_admin','order','shipping','shipping_configuration','payout','media','media_admin','payment','payment_callback','payment_refund','payment_configuration','sms_configuration','goghdi_configuration','auth_configuration','staff_setup','bridge','signed_ticket','ai_profile','ai_profile_test','ai_run','product_bulk_undo','analytics')
);

RESET statement_timeout;
RESET lock_timeout;
