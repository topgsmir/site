SET lock_timeout = '5s';
BEGIN;

CREATE TABLE media_deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source media_asset_source NOT NULL,
  asset_id UUID NOT NULL,
  seller_id TEXT NOT NULL REFERENCES sellers(id) ON DELETE RESTRICT,
  requested_by_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  reason VARCHAR(500) NOT NULL CONSTRAINT media_deletion_reason_check CHECK (length(btrim(reason)) BETWEEN 3 AND 500),
  status VARCHAR(16) NOT NULL DEFAULT 'pending' CONSTRAINT media_deletion_status_check CHECK (status IN ('pending', 'approved', 'rejected')),
  requested_at TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  reviewed_by_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at TIMESTAMPTZ(3),
  review_reason VARCHAR(500),
  CONSTRAINT media_deletion_review_check CHECK (
    (status = 'pending' AND reviewed_at IS NULL AND reviewed_by_id IS NULL) OR
    (status <> 'pending' AND reviewed_at IS NOT NULL)
  )
);

CREATE UNIQUE INDEX media_deletion_one_pending_idx ON media_deletion_requests(source, asset_id) WHERE status = 'pending';
CREATE INDEX media_deletion_seller_created_idx ON media_deletion_requests(seller_id, requested_at DESC, id DESC);
CREATE INDEX media_deletion_seller_asset_latest_idx ON media_deletion_requests(seller_id, source, asset_id, requested_at DESC);
CREATE INDEX media_deletion_queue_idx ON media_deletion_requests(status, requested_at, id);
CREATE INDEX media_deletion_requester_idx ON media_deletion_requests(requested_by_id);
CREATE INDEX media_deletion_reviewer_idx ON media_deletion_requests(reviewed_by_id);

COMMIT;
RESET lock_timeout;
