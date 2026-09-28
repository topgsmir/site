SET lock_timeout = '5s';
BEGIN;

CREATE TABLE admin_user_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  actor_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  body TEXT NOT NULL CONSTRAINT admin_user_notes_body_check CHECK (length(btrim(body)) BETWEEN 3 AND 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX admin_user_notes_user_created_idx ON admin_user_notes(user_id, created_at DESC, id DESC);
CREATE INDEX admin_user_notes_actor_idx ON admin_user_notes(actor_user_id);
COMMIT;
RESET lock_timeout;
