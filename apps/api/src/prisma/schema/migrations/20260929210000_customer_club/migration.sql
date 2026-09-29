SET lock_timeout = '5s';

ALTER TABLE sms_settings ADD COLUMN club_redemption_template_id INTEGER;
ALTER TABLE sms_settings ADD COLUMN club_expiry_template_id INTEGER;
ALTER TABLE sms_setting_events ADD COLUMN club_redemption_template_id INTEGER;
ALTER TABLE sms_setting_events ADD COLUMN club_expiry_template_id INTEGER;

CREATE INDEX CONCURRENTLY IF NOT EXISTS outbox_events_club_source_idx
  ON outbox_events (created_at, id)
  WHERE event_type IN ('order.paid','order.status.updated','payment.refunded');

CREATE TABLE club_settings (
  id INTEGER PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  enabled BOOLEAN NOT NULL DEFAULT false,
  activated_at TIMESTAMPTZ(3),
  enabled_since TIMESTAMPTZ(3),
  points_per_1000_toman INTEGER CHECK (points_per_1000_toman > 0),
  toman_per_point INTEGER CHECK (toman_per_point > 0),
  signup_points INTEGER NOT NULL DEFAULT 0 CHECK (signup_points >= 0),
  first_purchase_points INTEGER NOT NULL DEFAULT 0 CHECK (first_purchase_points >= 0),
  min_redeem_points INTEGER CHECK (min_redeem_points > 0),
  max_redeem_points INTEGER CHECK (max_redeem_points > 0),
  expiry_days INTEGER NOT NULL DEFAULT 365 CHECK (expiry_days BETWEEN 1 AND 3650),
  updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT now()
);
INSERT INTO club_settings (id) VALUES (1);

CREATE TABLE club_rule_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  effective_at TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  enabled BOOLEAN NOT NULL,
  points_per_1000_toman INTEGER,
  first_purchase_points INTEGER NOT NULL CHECK (first_purchase_points >= 0),
  expiry_days INTEGER NOT NULL CHECK (expiry_days BETWEEN 1 AND 3650)
);
CREATE INDEX club_rule_versions_effective_idx ON club_rule_versions(effective_at DESC, id DESC);

CREATE TABLE club_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name_fa TEXT NOT NULL, name_en TEXT NOT NULL, name_ar TEXT NOT NULL,
  threshold_toman NUMERIC(20,0) NOT NULL CHECK (threshold_toman >= 0),
  sort_order INTEGER NOT NULL UNIQUE, active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT now()
);
CREATE INDEX club_tiers_active_threshold_idx ON club_tiers(active, threshold_toman);

CREATE TABLE club_members (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE RESTRICT,
  balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  point_debt INTEGER NOT NULL DEFAULT 0 CHECK (point_debt >= 0),
  lifetime_earned INTEGER NOT NULL DEFAULT 0 CHECK (lifetime_earned >= 0),
  tier_override_id UUID REFERENCES club_tiers(id) ON DELETE RESTRICT,
  override_until TIMESTAMPTZ(3), override_reason TEXT,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT now()
);
CREATE INDEX club_members_balance_idx ON club_members(balance);
CREATE INDEX club_members_override_idx ON club_members(tier_override_id);

CREATE TABLE club_point_lots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id TEXT NOT NULL REFERENCES club_members(user_id) ON DELETE RESTRICT,
  source_key TEXT NOT NULL UNIQUE, original INTEGER NOT NULL CHECK (original > 0),
  remaining INTEGER NOT NULL CHECK (remaining >= 0 AND remaining <= original),
  debt_paid INTEGER NOT NULL DEFAULT 0 CHECK (debt_paid >= 0 AND debt_paid <= original AND remaining + debt_paid <= original),
  expires_at TIMESTAMPTZ(3) NOT NULL, created_at TIMESTAMPTZ(3) NOT NULL DEFAULT now()
);
CREATE INDEX club_point_lots_expiry_idx ON club_point_lots(user_id, expires_at, id);

CREATE TABLE club_point_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id TEXT NOT NULL REFERENCES club_members(user_id) ON DELETE RESTRICT,
  operation_key TEXT NOT NULL UNIQUE, delta INTEGER NOT NULL CHECK (delta <> 0),
  balance_after INTEGER NOT NULL CHECK (balance_after >= 0), kind TEXT NOT NULL,
  reference_id TEXT, created_at TIMESTAMPTZ(3) NOT NULL DEFAULT now()
);
CREATE INDEX club_point_entries_history_idx ON club_point_entries(user_id, created_at DESC, id DESC);
CREATE FUNCTION reject_club_point_entry_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'club point entries are immutable'; END; $$;
CREATE TRIGGER club_point_entries_immutable BEFORE UPDATE OR DELETE ON club_point_entries
FOR EACH ROW EXECUTE FUNCTION reject_club_point_entry_change();

CREATE TABLE club_rewards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name_fa TEXT NOT NULL, name_en TEXT NOT NULL, name_ar TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('wallet','fixed_discount','percentage_discount')),
  points_cost INTEGER NOT NULL CHECK (points_cost > 0), value NUMERIC(20,0) NOT NULL CHECK (value > 0),
  max_discount NUMERIC(20,0), min_order NUMERIC(20,0), active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT now()
);
CREATE INDEX club_rewards_active_kind_idx ON club_rewards(active, kind);

CREATE TABLE club_campaigns (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), name_fa TEXT NOT NULL, name_en TEXT NOT NULL, name_ar TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('bonus','multiplier')), value NUMERIC(12,2) NOT NULL CHECK (value > 0),
  starts_at TIMESTAMPTZ(3) NOT NULL, ends_at TIMESTAMPTZ(3) NOT NULL,
  min_tier_id UUID REFERENCES club_tiers(id) ON DELETE RESTRICT, active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  CONSTRAINT club_campaign_window CHECK (ends_at > starts_at)
);
CREATE INDEX club_campaigns_window_idx ON club_campaigns(active, starts_at, ends_at);
CREATE INDEX club_campaigns_tier_idx ON club_campaigns(min_tier_id);

CREATE TABLE club_campaign_versions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID NOT NULL REFERENCES club_campaigns(id) ON DELETE RESTRICT,
  effective_at TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  kind TEXT NOT NULL CHECK (kind IN ('bonus','multiplier')),
  value NUMERIC(12,2) NOT NULL CHECK (value > 0),
  starts_at TIMESTAMPTZ(3) NOT NULL,
  ends_at TIMESTAMPTZ(3) NOT NULL,
  min_tier_id UUID REFERENCES club_tiers(id) ON DELETE RESTRICT,
  active BOOLEAN NOT NULL
);
CREATE INDEX club_campaign_versions_effective_idx ON club_campaign_versions(campaign_id, effective_at DESC, id DESC);

CREATE TABLE club_order_earnings (
  order_id TEXT PRIMARY KEY REFERENCES orders(id) ON DELETE RESTRICT,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  eligible_toman NUMERIC(20,0) NOT NULL CHECK (eligible_toman >= 0), points INTEGER NOT NULL CHECK (points >= 0),
  campaign_id UUID REFERENCES club_campaigns(id) ON DELETE RESTRICT,
  campaign_points INTEGER NOT NULL DEFAULT 0 CHECK (campaign_points >= 0),
  reversed_at TIMESTAMPTZ(3), created_at TIMESTAMPTZ(3) NOT NULL DEFAULT now()
);
CREATE INDEX club_order_earnings_user_window_idx ON club_order_earnings(user_id, created_at);
CREATE INDEX club_order_earnings_campaign_idx ON club_order_earnings(campaign_id);

CREATE TABLE club_checkout_reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), checkout_id TEXT NOT NULL UNIQUE REFERENCES checkouts(id) ON DELETE RESTRICT,
  user_id TEXT NOT NULL REFERENCES club_members(user_id) ON DELETE RESTRICT,
  reward_id UUID REFERENCES club_rewards(id) ON DELETE RESTRICT,
  points INTEGER NOT NULL CHECK (points > 0), discount_toman NUMERIC(20,0) NOT NULL CHECK (discount_toman > 0),
  status TEXT NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved','paid','released')),
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ(3) NOT NULL DEFAULT now()
);
CREATE INDEX club_checkout_reservations_status_idx ON club_checkout_reservations(status, updated_at);

CREATE TABLE club_order_discounts (
  order_id TEXT PRIMARY KEY REFERENCES orders(id) ON DELETE RESTRICT,
  reservation_id UUID NOT NULL REFERENCES club_checkout_reservations(id) ON DELETE RESTRICT,
  points INTEGER NOT NULL CHECK (points >= 0),
  discount_toman NUMERIC(20,0) NOT NULL CHECK (discount_toman >= 0),
  subsidy_toman NUMERIC(20,0) NOT NULL CHECK (subsidy_toman >= 0),
  status TEXT NOT NULL DEFAULT 'reserved' CHECK (status IN ('reserved','paid','released'))
);
CREATE INDEX club_order_discounts_reservation_idx ON club_order_discounts(reservation_id);

CREATE TABLE club_point_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), reservation_id UUID REFERENCES club_checkout_reservations(id) ON DELETE RESTRICT,
  operation_key TEXT NOT NULL, lot_id UUID NOT NULL REFERENCES club_point_lots(id) ON DELETE RESTRICT,
  points INTEGER NOT NULL CHECK (points > 0), released_at TIMESTAMPTZ(3), UNIQUE(operation_key, lot_id)
);
CREATE INDEX club_point_allocations_reservation_idx ON club_point_allocations(reservation_id);

CREATE TABLE club_wallet_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  source_key TEXT NOT NULL UNIQUE, original_toman NUMERIC(20,0) NOT NULL CHECK (original_toman > 0),
  remaining_toman NUMERIC(20,0) NOT NULL CHECK (remaining_toman >= 0 AND remaining_toman <= original_toman),
  expires_at TIMESTAMPTZ(3) NOT NULL, created_at TIMESTAMPTZ(3) NOT NULL DEFAULT now()
);
CREATE INDEX club_wallet_credits_expiry_idx ON club_wallet_credits(user_id, expires_at, id);

CREATE TABLE club_wallet_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), credit_id UUID NOT NULL REFERENCES club_wallet_credits(id) ON DELETE RESTRICT,
  operation_key TEXT NOT NULL, amount_toman NUMERIC(20,0) NOT NULL CHECK (amount_toman > 0),
  released_at TIMESTAMPTZ(3), UNIQUE(credit_id, operation_key)
);
CREATE INDEX club_wallet_allocations_operation_idx ON club_wallet_allocations(operation_key);

CREATE TABLE club_wallet_refund_allocations (
  order_id TEXT NOT NULL REFERENCES orders(id) ON DELETE RESTRICT,
  credit_id UUID NOT NULL REFERENCES club_wallet_credits(id) ON DELETE RESTRICT,
  amount_toman NUMERIC(20,0) NOT NULL CHECK (amount_toman >= 0),
  restored_toman NUMERIC(20,0) NOT NULL CHECK (restored_toman >= 0 AND restored_toman <= amount_toman),
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT now(),
  PRIMARY KEY (order_id, credit_id)
);
CREATE INDEX club_wallet_refund_allocations_credit_idx ON club_wallet_refund_allocations(credit_id);

CREATE TABLE club_admin_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(), actor_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  action TEXT NOT NULL, target_id TEXT, detail JSONB NOT NULL,
  created_at TIMESTAMPTZ(3) NOT NULL DEFAULT now()
);
CREATE INDEX club_admin_events_actor_idx ON club_admin_events(actor_user_id, created_at DESC);

ALTER TABLE wallet_entries DROP CONSTRAINT wallet_entries_kind_check;
ALTER TABLE wallet_entries ADD CONSTRAINT wallet_entries_kind_check
  CHECK (kind IN ('topup','checkout_debit','checkout_release','order_refund','admin_credit','admin_debit','club_credit','club_expiry'));
