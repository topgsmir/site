ALTER TABLE "auth_rate_limits"
  DROP CONSTRAINT "auth_rate_limits_action_check",
  ADD CONSTRAINT "auth_rate_limits_action_check"
    CHECK (
      "action" IN (
        'login','register','order','payout','media','otp','payment',
        'payment_callback','payment_refund','payment_configuration','staff_setup',
        'bridge','signed_ticket','ai_profile','ai_profile_test','ai_run','product_bulk_undo'
      )
    );

-- Connection tests previously shared the ai_profile bucket. Clear those counters
-- so admins do not carry an old block into the dedicated, higher test limit.
DELETE FROM "auth_rate_limits"
WHERE "action" IN ('ai_profile', 'ai_profile_test');
