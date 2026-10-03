-- Read-only triage for legacy active buyer phones assigned by an administrator.
-- Run against a trusted copy or with authorized database access. A consumed OTP
-- only proves control of the phone, not that the holder was the intended buyer.
WITH assignments AS (
  SELECT DISTINCT ON (u.id)
    u.id AS user_id,
    u.support_code,
    u.phone_number,
    c.created_at AS assigned_at
  FROM users AS u
  JOIN admin_user_profile_changes AS c ON c.user_id = u.id
  WHERE u.role = 'buyer'
    AND u.account_status = 'active'
    AND u.phone_number IS NOT NULL
    AND c.after_data ? 'phoneNumber'
    AND c.after_data ->> 'phoneNumber' = u.phone_number
    AND c.before_data ->> 'phoneNumber' IS DISTINCT FROM c.after_data ->> 'phoneNumber'
  ORDER BY u.id, c.created_at DESC, c.id DESC
)
SELECT a.user_id, a.support_code, a.phone_number, a.assigned_at
FROM assignments AS a
WHERE NOT EXISTS (
  SELECT 1 FROM otp_challenges AS o
  WHERE o.phone_number = a.phone_number
    AND o.status = 'consumed'
    AND o.consumed_at >= a.assigned_at
)
ORDER BY a.assigned_at DESC, a.user_id;
