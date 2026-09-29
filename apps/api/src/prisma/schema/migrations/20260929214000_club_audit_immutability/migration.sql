CREATE FUNCTION reject_club_audit_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'club audit records are immutable'; END; $$;

CREATE TRIGGER club_rule_versions_immutable BEFORE UPDATE OR DELETE ON club_rule_versions
FOR EACH ROW EXECUTE FUNCTION reject_club_audit_change();
CREATE TRIGGER club_campaign_versions_immutable BEFORE UPDATE OR DELETE ON club_campaign_versions
FOR EACH ROW EXECUTE FUNCTION reject_club_audit_change();
CREATE TRIGGER club_admin_events_immutable BEFORE UPDATE OR DELETE ON club_admin_events
FOR EACH ROW EXECUTE FUNCTION reject_club_audit_change();
