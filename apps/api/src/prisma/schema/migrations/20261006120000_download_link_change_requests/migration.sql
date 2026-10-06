CREATE TABLE "download_link_change_requests" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "offer_id" UUID NOT NULL,
  "seller_id" TEXT NOT NULL,
  "requested_by_id" TEXT NOT NULL,
  "reviewed_by_id" TEXT,
  "action" VARCHAR(8) NOT NULL,
  "status" VARCHAR(16) NOT NULL DEFAULT 'pending',
  "link_index" INTEGER NOT NULL,
  "expected_url" VARCHAR(2048) NOT NULL,
  "expected_title" VARCHAR(120) NOT NULL,
  "proposed_url" VARCHAR(2048),
  "proposed_title" VARCHAR(120),
  "review_reason" VARCHAR(500),
  "requested_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewed_at" TIMESTAMPTZ(3),
  CONSTRAINT "download_link_change_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "download_link_change_action_check" CHECK ("action" IN ('edit', 'delete')),
  CONSTRAINT "download_link_change_status_check" CHECK ("status" IN ('pending', 'approved', 'rejected')),
  CONSTRAINT "download_link_change_index_check" CHECK ("link_index" BETWEEN 0 AND 49),
  CONSTRAINT "download_link_change_proposal_check" CHECK (
    ("action" = 'edit' AND "proposed_url" IS NOT NULL AND "proposed_title" IS NOT NULL)
    OR ("action" = 'delete' AND "proposed_url" IS NULL AND "proposed_title" IS NULL)
  ),
  CONSTRAINT "download_link_change_review_check" CHECK (
    ("status" = 'pending' AND "reviewed_by_id" IS NULL AND "reviewed_at" IS NULL)
    OR ("status" <> 'pending' AND "reviewed_by_id" IS NOT NULL AND "reviewed_at" IS NOT NULL)
  ),
  CONSTRAINT "download_link_change_offer_fkey" FOREIGN KEY ("offer_id") REFERENCES "seller_offers"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "download_link_change_seller_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "download_link_change_requester_fkey" FOREIGN KEY ("requested_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "download_link_change_reviewer_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "download_link_change_requests_seller_requested_at_id_idx" ON "download_link_change_requests"("seller_id", "requested_at" DESC, "id" DESC);
CREATE INDEX "download_link_change_requests_status_requested_at_id_idx" ON "download_link_change_requests"("status", "requested_at", "id");
CREATE UNIQUE INDEX "download_link_change_one_pending_per_offer_index" ON "download_link_change_requests"("offer_id", "link_index") WHERE "status" = 'pending';
