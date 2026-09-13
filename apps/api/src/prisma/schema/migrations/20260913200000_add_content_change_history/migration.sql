BEGIN;

CREATE TYPE "content_change_action" AS ENUM ('create', 'update', 'review', 'restore');

CREATE TABLE "product_change_events" (
    "id" TEXT NOT NULL,
    "product_id" TEXT NOT NULL,
    "actor_user_id" TEXT NOT NULL,
    "action" "content_change_action" NOT NULL,
    "changed_fields" TEXT[] NOT NULL,
    "before_snapshot" JSONB,
    "after_snapshot" JSONB NOT NULL,
    "restored_from_event_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "product_change_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "product_change_events_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "product_change_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "product_change_events_restored_from_event_id_fkey" FOREIGN KEY ("restored_from_event_id") REFERENCES "product_change_events"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE "blog_change_events" (
    "id" TEXT NOT NULL,
    "post_id" TEXT NOT NULL,
    "actor_user_id" TEXT NOT NULL,
    "action" "content_change_action" NOT NULL,
    "changed_fields" TEXT[] NOT NULL,
    "before_snapshot" JSONB,
    "after_snapshot" JSONB NOT NULL,
    "restored_from_event_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "blog_change_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "blog_change_events_post_id_fkey" FOREIGN KEY ("post_id") REFERENCES "blog_posts"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "blog_change_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "blog_change_events_restored_from_event_id_fkey" FOREIGN KEY ("restored_from_event_id") REFERENCES "blog_change_events"("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE INDEX "product_change_events_product_id_created_at_id_idx" ON "product_change_events"("product_id", "created_at" DESC, "id" DESC);
CREATE INDEX "product_change_events_created_at_id_idx" ON "product_change_events"("created_at" DESC, "id" DESC);
CREATE INDEX "product_change_events_actor_user_id_idx" ON "product_change_events"("actor_user_id");
CREATE INDEX "blog_change_events_post_id_created_at_id_idx" ON "blog_change_events"("post_id", "created_at" DESC, "id" DESC);
CREATE INDEX "blog_change_events_created_at_id_idx" ON "blog_change_events"("created_at" DESC, "id" DESC);
CREATE INDEX "blog_change_events_actor_user_id_idx" ON "blog_change_events"("actor_user_id");

COMMIT;
