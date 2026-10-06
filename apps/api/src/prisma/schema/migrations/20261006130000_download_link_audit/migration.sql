CREATE TABLE "download_link_change_events" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "offer_id" UUID NOT NULL,
  "actor_user_id" TEXT NOT NULL,
  "request_id" UUID,
  "action" VARCHAR(16) NOT NULL,
  "before_urls" TEXT[] NOT NULL,
  "before_titles" TEXT[] NOT NULL,
  "after_urls" TEXT[] NOT NULL,
  "after_titles" TEXT[] NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "download_link_change_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "download_link_change_events_action_check" CHECK ("action" IN ('admin_replace', 'seller_add', 'approved_edit', 'approved_delete')),
  CONSTRAINT "download_link_change_events_lengths_check" CHECK (
    cardinality("before_urls") = cardinality("before_titles") AND
    cardinality("after_urls") = cardinality("after_titles")
  )
);

CREATE INDEX "download_link_change_events_offer_created_idx" ON "download_link_change_events"("offer_id", "created_at" DESC, "id" DESC);
CREATE INDEX "download_link_change_events_actor_user_id_idx" ON "download_link_change_events"("actor_user_id");
