CREATE EXTENSION IF NOT EXISTS pg_trgm;

ALTER TYPE "user_role" ADD VALUE IF NOT EXISTS 'platform_staff';

CREATE TYPE "platform_permission" AS ENUM ('vendors_manage', 'catalog_view', 'orders_manage', 'payouts_manage', 'blog_manage');
CREATE TYPE "blog_locale" AS ENUM ('fa', 'en', 'ar');
CREATE TYPE "blog_revision_status" AS ENUM ('draft', 'pending_review', 'published', 'rejected');
CREATE TYPE "blog_media_kind" AS ENUM ('cover', 'inline');
CREATE TYPE "staff_invitation_status" AS ENUM ('pending', 'accepted', 'revoked');

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "blog_posts" LIMIT 1) THEN
    RAISE EXCEPTION 'Multilingual blog rollout requires blog_posts to be empty';
  END IF;
END $$;

ALTER TABLE "sellers" ADD COLUMN "blog_review_required" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE "blog_posts"
  ALTER COLUMN "seller_id" DROP NOT NULL,
  ALTER COLUMN "title" DROP NOT NULL,
  ALTER COLUMN "slug" DROP NOT NULL,
  ALTER COLUMN "content" DROP NOT NULL,
  ADD COLUMN "creator_user_id" TEXT NOT NULL,
  ADD COLUMN "working_revision_id" TEXT,
  ADD COLUMN "published_revision_id" TEXT,
  ADD COLUMN "archived_at" TIMESTAMPTZ,
  ADD COLUMN "featured_rank" INTEGER;

CREATE TABLE "platform_staff_permissions" (
  "user_id" TEXT NOT NULL,
  "permission" "platform_permission" NOT NULL,
  "granted_by_id" TEXT NOT NULL,
  "granted_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "platform_staff_permissions_pkey" PRIMARY KEY ("user_id", "permission")
);

CREATE TABLE "platform_staff_invitations" (
  "id" TEXT NOT NULL,
  "email" VARCHAR(320) NOT NULL,
  "full_name" VARCHAR(200) NOT NULL,
  "token_hash" CHAR(64) NOT NULL,
  "permissions" "platform_permission"[] NOT NULL,
  "status" "staff_invitation_status" NOT NULL DEFAULT 'pending',
  "expires_at" TIMESTAMPTZ NOT NULL,
  "revoked_at" TIMESTAMPTZ,
  "accepted_at" TIMESTAMPTZ,
  "created_by_id" TEXT NOT NULL,
  "accepted_by_id" TEXT,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "platform_staff_invitations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "blog_categories" (
  "id" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "blog_categories_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "blog_category_translations" (
  "category_id" TEXT NOT NULL,
  "locale" "blog_locale" NOT NULL,
  "name" VARCHAR(100) NOT NULL,
  "slug" VARCHAR(120) NOT NULL,
  CONSTRAINT "blog_category_translations_pkey" PRIMARY KEY ("category_id", "locale")
);

CREATE TABLE "blog_tags" (
  "id" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "blog_tags_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "blog_tag_translations" (
  "tag_id" TEXT NOT NULL,
  "locale" "blog_locale" NOT NULL,
  "name" VARCHAR(80) NOT NULL,
  "slug" VARCHAR(100) NOT NULL,
  CONSTRAINT "blog_tag_translations_pkey" PRIMARY KEY ("tag_id", "locale")
);

CREATE TABLE "blog_media_assets" (
  "id" TEXT NOT NULL,
  "owner_user_id" TEXT NOT NULL,
  "seller_id" TEXT,
  "post_id" TEXT,
  "kind" "blog_media_kind" NOT NULL,
  "width" INTEGER NOT NULL,
  "height" INTEGER NOT NULL,
  "byte_size" INTEGER NOT NULL,
  "checksum" CHAR(64) NOT NULL,
  "published_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "blog_media_assets_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "blog_media_assets_dimensions_check" CHECK ("width" > 0 AND "height" > 0 AND "width" * "height" <= 24000000),
  CONSTRAINT "blog_media_assets_size_check" CHECK ("byte_size" > 0 AND "byte_size" <= 8388608)
);

CREATE TABLE "blog_media_variants" (
  "asset_id" TEXT NOT NULL,
  "variant" VARCHAR(32) NOT NULL,
  "width" INTEGER NOT NULL,
  "height" INTEGER NOT NULL,
  "byte_size" INTEGER NOT NULL,
  "path" VARCHAR(500) NOT NULL,
  CONSTRAINT "blog_media_variants_pkey" PRIMARY KEY ("asset_id", "variant")
);

CREATE TABLE "blog_revisions" (
  "id" TEXT NOT NULL,
  "post_id" TEXT NOT NULL,
  "revision_number" INTEGER NOT NULL,
  "optimistic_version" INTEGER NOT NULL DEFAULT 1,
  "status" "blog_revision_status" NOT NULL DEFAULT 'draft',
  "cover_asset_id" TEXT,
  "category_id" TEXT,
  "moderation_note" VARCHAR(2000),
  "moderated_by_id" TEXT,
  "submitted_at" TIMESTAMPTZ,
  "published_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "blog_revisions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "blog_revisions_numbers_check" CHECK ("revision_number" > 0 AND "optimistic_version" > 0)
);

CREATE TABLE "blog_revision_translations" (
  "revision_id" TEXT NOT NULL,
  "locale" "blog_locale" NOT NULL,
  "title" VARCHAR(200),
  "slug_proposal" VARCHAR(200),
  "excerpt" VARCHAR(500),
  "seo_title" VARCHAR(70),
  "seo_description" VARCHAR(170),
  "cover_alt_text" VARCHAR(300),
  "content_json" JSONB,
  CONSTRAINT "blog_revision_translations_pkey" PRIMARY KEY ("revision_id", "locale")
);

CREATE TABLE "blog_revision_tags" (
  "revision_id" TEXT NOT NULL,
  "tag_id" TEXT NOT NULL,
  CONSTRAINT "blog_revision_tags_pkey" PRIMARY KEY ("revision_id", "tag_id")
);

CREATE TABLE "blog_revision_products" (
  "revision_id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "position" INTEGER NOT NULL,
  CONSTRAINT "blog_revision_products_pkey" PRIMARY KEY ("revision_id", "product_id"),
  CONSTRAINT "blog_revision_products_position_check" CHECK ("position" >= 0 AND "position" < 8)
);

CREATE TABLE "blog_routes" (
  "id" TEXT NOT NULL,
  "post_id" TEXT NOT NULL,
  "locale" "blog_locale" NOT NULL,
  "slug" VARCHAR(200) NOT NULL,
  "is_current" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "blog_routes_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "blog_moderation_events" (
  "id" TEXT NOT NULL,
  "post_id" TEXT NOT NULL,
  "revision_id" TEXT NOT NULL,
  "actor_id" TEXT NOT NULL,
  "from_status" "blog_revision_status" NOT NULL,
  "to_status" "blog_revision_status" NOT NULL,
  "note" VARCHAR(2000),
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "blog_moderation_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "seller_agents" (
  "id" TEXT NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "specialty" VARCHAR(200) NOT NULL,
  "rating" DECIMAL(2,1) NOT NULL,
  "phone" VARCHAR(32),
  "available" BOOLEAN NOT NULL DEFAULT true,
  "created_by_user_id" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "seller_agents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "seller_agents_rating_check" CHECK ("rating" >= 0 AND "rating" <= 5)
);

CREATE TABLE "seller_invitations" (
  "id" TEXT NOT NULL,
  "owner_name" VARCHAR(160) NOT NULL,
  "owner_email" VARCHAR(320) NOT NULL,
  "phone_number" VARCHAR(32) NOT NULL,
  "status" VARCHAR(32) NOT NULL DEFAULT 'invited',
  "created_by_user_id" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "seller_invitations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "platform_staff_invitations_token_hash_key" ON "platform_staff_invitations"("token_hash");
CREATE INDEX "platform_staff_invitations_email_status_idx" ON "platform_staff_invitations"("email", "status");
CREATE INDEX "platform_staff_invitations_expires_status_idx" ON "platform_staff_invitations"("expires_at", "status");
CREATE INDEX "platform_staff_permissions_granted_by_idx" ON "platform_staff_permissions"("granted_by_id");
CREATE UNIQUE INDEX "blog_category_translations_locale_slug_key" ON "blog_category_translations"("locale", "slug");
CREATE UNIQUE INDEX "blog_tag_translations_locale_slug_key" ON "blog_tag_translations"("locale", "slug");
CREATE UNIQUE INDEX "blog_revisions_post_number_key" ON "blog_revisions"("post_id", "revision_number");
CREATE INDEX "blog_revisions_moderation_queue_idx" ON "blog_revisions"("status", "submitted_at", "id");
CREATE INDEX "blog_revisions_category_public_idx" ON "blog_revisions"("category_id", "status", "published_at");
CREATE INDEX "blog_revision_tags_tag_revision_idx" ON "blog_revision_tags"("tag_id", "revision_id");
CREATE UNIQUE INDEX "blog_revision_products_revision_position_key" ON "blog_revision_products"("revision_id", "position");
CREATE INDEX "blog_revision_products_product_revision_idx" ON "blog_revision_products"("product_id", "revision_id");
CREATE UNIQUE INDEX "blog_routes_locale_slug_key" ON "blog_routes"("locale", "slug");
CREATE UNIQUE INDEX "blog_routes_one_current_per_locale" ON "blog_routes"("post_id", "locale") WHERE "is_current";
CREATE INDEX "blog_routes_post_locale_current_idx" ON "blog_routes"("post_id", "locale", "is_current");
CREATE INDEX "blog_posts_creator_management_idx" ON "blog_posts"("creator_user_id", "updated_at", "id");
CREATE INDEX "blog_posts_public_order_idx" ON "blog_posts"("archived_at", "published_at", "id");
CREATE INDEX "blog_posts_featured_idx" ON "blog_posts"("featured_rank", "published_at");
CREATE INDEX "blog_media_assets_owner_created_idx" ON "blog_media_assets"("owner_user_id", "created_at");
CREATE INDEX "blog_media_assets_seller_created_idx" ON "blog_media_assets"("seller_id", "created_at");
CREATE INDEX "blog_media_assets_orphan_cleanup_idx" ON "blog_media_assets"("published_at", "created_at");
CREATE INDEX "blog_moderation_events_post_created_idx" ON "blog_moderation_events"("post_id", "created_at");
CREATE INDEX "blog_moderation_events_actor_created_idx" ON "blog_moderation_events"("actor_id", "created_at");
CREATE INDEX "seller_agents_available_name_idx" ON "seller_agents"("available", "name");
CREATE UNIQUE INDEX "seller_invitations_owner_email_status_key" ON "seller_invitations"("owner_email", "status");
CREATE INDEX "seller_invitations_created_idx" ON "seller_invitations"("created_at", "id");
CREATE INDEX "products_title_trgm_idx" ON "products" USING GIN ("title" gin_trgm_ops);
CREATE INDEX "products_slug_trgm_idx" ON "products" USING GIN ("slug" gin_trgm_ops);

ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_creator_user_id_fkey" FOREIGN KEY ("creator_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "platform_staff_permissions" ADD CONSTRAINT "platform_staff_permissions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "platform_staff_permissions" ADD CONSTRAINT "platform_staff_permissions_granted_by_id_fkey" FOREIGN KEY ("granted_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "platform_staff_invitations" ADD CONSTRAINT "platform_staff_invitations_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "platform_staff_invitations" ADD CONSTRAINT "platform_staff_invitations_accepted_by_id_fkey" FOREIGN KEY ("accepted_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "blog_category_translations" ADD CONSTRAINT "blog_category_translations_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "blog_categories"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "blog_tag_translations" ADD CONSTRAINT "blog_tag_translations_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "blog_tags"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "blog_media_assets" ADD CONSTRAINT "blog_media_assets_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "blog_media_assets" ADD CONSTRAINT "blog_media_assets_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "blog_media_assets" ADD CONSTRAINT "blog_media_assets_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "blog_posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "blog_media_variants" ADD CONSTRAINT "blog_media_variants_asset_id_fkey" FOREIGN KEY ("asset_id") REFERENCES "blog_media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "blog_revisions" ADD CONSTRAINT "blog_revisions_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "blog_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "blog_revisions" ADD CONSTRAINT "blog_revisions_cover_asset_id_fkey" FOREIGN KEY ("cover_asset_id") REFERENCES "blog_media_assets"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "blog_revisions" ADD CONSTRAINT "blog_revisions_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "blog_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "blog_revisions" ADD CONSTRAINT "blog_revisions_moderated_by_id_fkey" FOREIGN KEY ("moderated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_working_revision_id_fkey" FOREIGN KEY ("working_revision_id") REFERENCES "blog_revisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "blog_posts" ADD CONSTRAINT "blog_posts_published_revision_id_fkey" FOREIGN KEY ("published_revision_id") REFERENCES "blog_revisions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "blog_revision_translations" ADD CONSTRAINT "blog_revision_translations_revision_id_fkey" FOREIGN KEY ("revision_id") REFERENCES "blog_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "blog_revision_tags" ADD CONSTRAINT "blog_revision_tags_revision_id_fkey" FOREIGN KEY ("revision_id") REFERENCES "blog_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "blog_revision_tags" ADD CONSTRAINT "blog_revision_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "blog_tags"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "blog_revision_products" ADD CONSTRAINT "blog_revision_products_revision_id_fkey" FOREIGN KEY ("revision_id") REFERENCES "blog_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "blog_revision_products" ADD CONSTRAINT "blog_revision_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "blog_routes" ADD CONSTRAINT "blog_routes_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "blog_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "blog_moderation_events" ADD CONSTRAINT "blog_moderation_events_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "blog_posts"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "blog_moderation_events" ADD CONSTRAINT "blog_moderation_events_revision_id_fkey" FOREIGN KEY ("revision_id") REFERENCES "blog_revisions"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "blog_moderation_events" ADD CONSTRAINT "blog_moderation_events_actor_id_fkey" FOREIGN KEY ("actor_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "seller_agents" ADD CONSTRAINT "seller_agents_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "seller_invitations" ADD CONSTRAINT "seller_invitations_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
