SET lock_timeout = '5s';
BEGIN;

ALTER TABLE admin_user_notes ADD COLUMN seller_visible BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX admin_user_notes_seller_visible_idx ON admin_user_notes(user_id, seller_visible, created_at DESC, id DESC);

COMMIT;
RESET lock_timeout;
