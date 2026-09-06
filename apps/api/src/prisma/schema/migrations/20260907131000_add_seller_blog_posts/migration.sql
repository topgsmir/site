CREATE TYPE "blog_post_status" AS ENUM ('draft', 'published', 'archived');

CREATE TABLE "blog_posts" (
  "id" TEXT NOT NULL,
  "seller_id" TEXT NOT NULL,
  "product_id" TEXT,
  "title" VARCHAR(200) NOT NULL,
  "slug" VARCHAR(200) NOT NULL,
  "excerpt" VARCHAR(500),
  "content" TEXT NOT NULL,
  "status" "blog_post_status" NOT NULL DEFAULT 'draft',
  "published_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "blog_posts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "blog_posts_title_check" CHECK (CHAR_LENGTH(BTRIM("title")) BETWEEN 2 AND 200),
  CONSTRAINT "blog_posts_slug_check" CHECK (CHAR_LENGTH(BTRIM("slug")) BETWEEN 1 AND 200),
  CONSTRAINT "blog_posts_excerpt_check" CHECK ("excerpt" IS NULL OR CHAR_LENGTH("excerpt") <= 500),
  CONSTRAINT "blog_posts_content_check" CHECK (CHAR_LENGTH(BTRIM("content")) BETWEEN 1 AND 50000),
  CONSTRAINT "blog_posts_published_at_check" CHECK ("status" <> 'published' OR "published_at" IS NOT NULL)
);

CREATE UNIQUE INDEX "blog_posts_slug_key" ON "blog_posts"("slug");
CREATE INDEX "blog_posts_seller_id_updated_at_id_idx" ON "blog_posts"("seller_id", "updated_at", "id");
CREATE INDEX "blog_posts_status_published_at_id_idx" ON "blog_posts"("status", "published_at", "id");
CREATE INDEX "blog_posts_product_id_idx" ON "blog_posts"("product_id");

ALTER TABLE "blog_posts"
  ADD CONSTRAINT "blog_posts_seller_id_fkey"
  FOREIGN KEY ("seller_id") REFERENCES "sellers"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "blog_posts"
  ADD CONSTRAINT "blog_posts_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

-- Preserve the access level of sellers who already manage catalog content.
INSERT INTO "seller_permissions" ("seller_id", "permission", "granted_by_id")
SELECT "seller_id", 'blog_manage'::"seller_permission", "granted_by_id"
FROM "seller_permissions"
WHERE "permission" = 'products_manage'::"seller_permission"
ON CONFLICT ("seller_id", "permission") DO NOTHING;
