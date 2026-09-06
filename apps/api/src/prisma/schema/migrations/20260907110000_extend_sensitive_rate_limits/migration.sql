ALTER TABLE "auth_rate_limits"
  DROP CONSTRAINT "auth_rate_limits_action_check",
  ADD CONSTRAINT "auth_rate_limits_action_check"
    CHECK ("action" IN ('login', 'register', 'order', 'payout'));
