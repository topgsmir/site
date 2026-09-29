CREATE TABLE club_point_debt_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL REFERENCES club_members(user_id) ON DELETE RESTRICT,
  operation_key TEXT NOT NULL UNIQUE,
  delta INTEGER NOT NULL CHECK (delta <> 0),
  debt_after INTEGER NOT NULL CHECK (debt_after >= 0),
  kind TEXT NOT NULL,
  reference_id TEXT,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT now()
);
CREATE INDEX club_point_debt_events_history_idx ON club_point_debt_events(user_id, created_at DESC, id DESC);
CREATE FUNCTION reject_club_point_debt_event_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'club point debt events are immutable'; END; $$;
CREATE TRIGGER club_point_debt_events_immutable BEFORE UPDATE OR DELETE ON club_point_debt_events
FOR EACH ROW EXECUTE FUNCTION reject_club_point_debt_event_change();
