-- Generalize the existing product comment tables in place so existing rows and
-- foreign-key identities are preserved without a data-copy migration.
ALTER TABLE "product_comment_settings" RENAME TO "comment_settings";
ALTER TABLE "product_comments" RENAME TO "comments";
ALTER TABLE "product_comment_assignments" RENAME TO "comment_assignments";
ALTER TABLE "product_comment_events" RENAME TO "comment_events";

ALTER TABLE "comment_settings" RENAME CONSTRAINT "product_comment_settings_pkey" TO "comment_settings_pkey";
ALTER TABLE "comment_settings" RENAME CONSTRAINT "product_comment_settings_singleton_check" TO "comment_settings_singleton_check";
ALTER TABLE "comment_settings" RENAME CONSTRAINT "product_comment_settings_posting_check" TO "comment_settings_posting_check";
ALTER TABLE "comment_settings" RENAME CONSTRAINT "product_comment_settings_publication_check" TO "comment_settings_publication_check";

ALTER TABLE "comments" RENAME CONSTRAINT "product_comments_pkey" TO "comments_pkey";
ALTER TABLE "comments" RENAME CONSTRAINT "product_comments_product_id_fkey" TO "comments_product_id_fkey";
ALTER TABLE "comments" RENAME CONSTRAINT "product_comments_author_user_id_fkey" TO "comments_author_user_id_fkey";
ALTER TABLE "comments" RENAME CONSTRAINT "product_comments_flagged_by_user_id_fkey" TO "comments_flagged_by_user_id_fkey";
ALTER TABLE "comments" RENAME CONSTRAINT "product_comments_author_check" TO "comments_author_check";
ALTER TABLE "comments" RENAME CONSTRAINT "product_comments_body_check" TO "comments_body_check";
ALTER TABLE "comments" RENAME CONSTRAINT "product_comments_status_check" TO "comments_status_check";
ALTER TABLE "comments" RENAME CONSTRAINT "product_comments_flag_check" TO "comments_flag_check";

ALTER TABLE "comment_assignments" RENAME CONSTRAINT "product_comment_assignments_comment_id_fkey" TO "comment_assignments_comment_id_fkey";
ALTER TABLE "comment_assignments" RENAME CONSTRAINT "product_comment_assignments_seller_id_fkey" TO "comment_assignments_seller_id_fkey";
ALTER TABLE "comment_assignments" RENAME CONSTRAINT "product_comment_assignments_replied_by_user_id_fkey" TO "comment_assignments_replied_by_user_id_fkey";
ALTER TABLE "comment_assignments" RENAME CONSTRAINT "product_comment_assignments_reply_check" TO "comment_assignments_reply_check";

ALTER TABLE "comment_events" RENAME CONSTRAINT "product_comment_events_pkey" TO "comment_events_pkey";
ALTER TABLE "comment_events" RENAME CONSTRAINT "product_comment_events_comment_id_fkey" TO "comment_events_comment_id_fkey";
ALTER TABLE "comment_events" RENAME CONSTRAINT "product_comment_events_actor_user_id_fkey" TO "comment_events_actor_user_id_fkey";

ALTER TABLE "comments"
  ALTER COLUMN "product_id" DROP NOT NULL,
  ADD COLUMN "blog_post_id" TEXT;

ALTER TABLE "comments"
  ADD CONSTRAINT "comments_blog_post_id_fkey"
    FOREIGN KEY ("blog_post_id") REFERENCES "blog_posts"("id") ON DELETE RESTRICT,
  ADD CONSTRAINT "comments_target_check"
    CHECK (("product_id" IS NOT NULL) <> ("blog_post_id" IS NOT NULL));

ALTER INDEX "product_comments_product_id_status_created_at_id_idx"
  RENAME TO "comments_product_id_status_created_at_id_idx";
ALTER INDEX "product_comments_status_created_at_id_idx"
  RENAME TO "comments_status_created_at_id_idx";
ALTER INDEX "product_comments_author_user_id_idx"
  RENAME TO "comments_author_user_id_idx";
ALTER INDEX "product_comments_flagged_by_user_id_idx"
  RENAME TO "comments_flagged_by_user_id_idx";
-- Some development databases were created while the original product-comments
-- migration was still being iterated on and do not have its optional search
-- index. Preserve it when present, and converge both states on the generic
-- index required by the admin comment search.
ALTER INDEX IF EXISTS "product_comments_body_trgm_idx"
  RENAME TO "comments_body_trgm_idx";
CREATE INDEX IF NOT EXISTS "comments_body_trgm_idx"
  ON "comments" USING GIN ("body" gin_trgm_ops);

CREATE INDEX "comments_blog_post_id_status_created_at_id_idx"
  ON "comments"("blog_post_id", "status", "created_at" DESC, "id" DESC);

ALTER TABLE "comment_assignments"
  ADD COLUMN "assignee_kind" VARCHAR(16) NOT NULL DEFAULT 'seller',
  ADD COLUMN "assignee_key" VARCHAR(64);

UPDATE "comment_assignments"
SET "assignee_key" = 'seller:' || "seller_id"
WHERE "assignee_key" IS NULL;

ALTER TABLE "comment_assignments"
  DROP CONSTRAINT "product_comment_assignments_pkey";

ALTER TABLE "comment_assignments"
  ALTER COLUMN "assignee_key" SET NOT NULL,
  ALTER COLUMN "seller_id" DROP NOT NULL,
  ADD CONSTRAINT "comment_assignments_pkey" PRIMARY KEY ("comment_id", "assignee_key"),
  ADD CONSTRAINT "comment_assignments_kind_check" CHECK (
    ("assignee_kind" = 'seller' AND "seller_id" IS NOT NULL AND "assignee_key" = 'seller:' || "seller_id")
    OR
    ("assignee_kind" = 'editorial' AND "seller_id" IS NULL AND "assignee_key" = 'editorial')
  );

ALTER TABLE "comment_assignments" ALTER COLUMN "assignee_kind" DROP DEFAULT;

ALTER INDEX "product_comment_assignments_seller_id_replied_at_comment_id_idx"
  RENAME TO "comment_assignments_seller_id_replied_at_comment_id_idx";
ALTER INDEX "product_comment_assignments_replied_by_user_id_idx"
  RENAME TO "comment_assignments_replied_by_user_id_idx";
ALTER INDEX "product_comment_events_comment_id_created_at_idx"
  RENAME TO "comment_events_comment_id_created_at_idx";
ALTER INDEX "product_comment_events_actor_user_id_created_at_idx"
  RENAME TO "comment_events_actor_user_id_created_at_idx";
