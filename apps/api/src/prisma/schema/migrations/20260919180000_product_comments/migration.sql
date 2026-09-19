CREATE TABLE "product_comment_settings" (
  "id" SMALLINT NOT NULL DEFAULT 1 PRIMARY KEY,
  "seller_lock_enabled" BOOLEAN NOT NULL DEFAULT false,
  "posting_policy" VARCHAR(16) NOT NULL DEFAULT 'purchasers',
  "publication_policy" VARCHAR(16) NOT NULL DEFAULT 'approval',
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  CONSTRAINT "product_comment_settings_singleton_check" CHECK ("id" = 1),
  CONSTRAINT "product_comment_settings_posting_check" CHECK ("posting_policy" IN ('purchasers', 'buyers', 'guests')),
  CONSTRAINT "product_comment_settings_publication_check" CHECK ("publication_policy" IN ('approval', 'immediate'))
);

CREATE TABLE "product_comments" (
  "id" UUID NOT NULL PRIMARY KEY,
  "product_id" TEXT NOT NULL REFERENCES "products"("id") ON DELETE RESTRICT,
  "author_user_id" TEXT REFERENCES "users"("id") ON DELETE RESTRICT,
  "guest_name" VARCHAR(100),
  "body" VARCHAR(2000) NOT NULL,
  "status" VARCHAR(16) NOT NULL DEFAULT 'pending',
  "flagged_by_user_id" TEXT REFERENCES "users"("id") ON DELETE RESTRICT,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  "published_at" TIMESTAMPTZ(3),
  CONSTRAINT "product_comments_author_check" CHECK (("author_user_id" IS NOT NULL) <> ("guest_name" IS NOT NULL)),
  CONSTRAINT "product_comments_body_check" CHECK (length(btrim("body")) BETWEEN 1 AND 2000),
  CONSTRAINT "product_comments_status_check" CHECK ("status" IN ('pending', 'approved', 'rejected', 'spam_review', 'spam')),
  CONSTRAINT "product_comments_flag_check" CHECK (("status" = 'spam_review') = ("flagged_by_user_id" IS NOT NULL))
);

CREATE TABLE "product_comment_assignments" (
  "comment_id" UUID NOT NULL REFERENCES "product_comments"("id") ON DELETE RESTRICT,
  "seller_id" TEXT NOT NULL REFERENCES "sellers"("id") ON DELETE RESTRICT,
  "reply_body" VARCHAR(2000),
  "replied_by_user_id" TEXT REFERENCES "users"("id") ON DELETE RESTRICT,
  "replied_at" TIMESTAMPTZ(3),
  CONSTRAINT "product_comment_assignments_pkey" PRIMARY KEY ("comment_id", "seller_id"),
  CONSTRAINT "product_comment_assignments_reply_check" CHECK (
    ("reply_body" IS NULL AND "replied_by_user_id" IS NULL AND "replied_at" IS NULL) OR
    ("reply_body" IS NOT NULL AND "replied_by_user_id" IS NOT NULL AND "replied_at" IS NOT NULL)
  )
);

CREATE TABLE "product_comment_events" (
  "id" UUID NOT NULL PRIMARY KEY,
  "comment_id" UUID REFERENCES "product_comments"("id") ON DELETE RESTRICT,
  "actor_user_id" TEXT NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "action" VARCHAR(32) NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT now()
);

CREATE INDEX "product_comments_product_id_status_created_at_id_idx" ON "product_comments"("product_id", "status", "created_at" DESC, "id" DESC);
CREATE INDEX "product_comments_status_created_at_id_idx" ON "product_comments"("status", "created_at" DESC, "id" DESC);
CREATE INDEX "product_comments_author_user_id_idx" ON "product_comments"("author_user_id");
CREATE INDEX "product_comments_flagged_by_user_id_idx" ON "product_comments"("flagged_by_user_id");
CREATE INDEX "product_comments_body_trgm_idx" ON "product_comments" USING GIN ("body" gin_trgm_ops);
CREATE INDEX "product_comment_assignments_seller_id_replied_at_comment_id_idx" ON "product_comment_assignments"("seller_id", "replied_at", "comment_id");
CREATE INDEX "product_comment_assignments_replied_by_user_id_idx" ON "product_comment_assignments"("replied_by_user_id");
CREATE INDEX "product_comment_events_comment_id_created_at_idx" ON "product_comment_events"("comment_id", "created_at" DESC);
CREATE INDEX "product_comment_events_actor_user_id_created_at_idx" ON "product_comment_events"("actor_user_id", "created_at" DESC);

ALTER TABLE "auth_rate_limits" DROP CONSTRAINT "auth_rate_limits_action_check";
ALTER TABLE "auth_rate_limits" ADD CONSTRAINT "auth_rate_limits_action_check" CHECK (
  "action" IN ('login','register','order','shipping','shipping_configuration','payout','media','otp','payment','payment_callback','payment_refund','payment_configuration','sms_configuration','staff_setup','bridge','signed_ticket','ai_profile','ai_profile_test','ai_run','product_bulk_undo','checkout_quote','analytics','auth_configuration','captcha_challenge','comment_submit','comment_reply','comment_admin')
);
