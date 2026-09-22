-- A nullable marker preserves the current behavior for users who have never opened
-- the operational orders workspace: all of their paid orders remain unseen.
ALTER TABLE "users" ADD COLUMN "orders_seen_at" TIMESTAMPTZ;
