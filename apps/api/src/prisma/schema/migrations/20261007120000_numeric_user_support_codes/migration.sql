BEGIN;
SET LOCAL lock_timeout = '5s';

-- Development reset: replace every user's code in one transaction. Keep old
-- numeric reservations so a previously issued code never identifies someone else.
LOCK TABLE users, user_support_code_reservations IN ACCESS EXCLUSIVE MODE;
ALTER TABLE users DROP CONSTRAINT users_support_code_format_check;
ALTER TABLE user_support_code_reservations
  DROP CONSTRAINT user_support_code_reservations_format_check;
DELETE FROM user_support_code_reservations WHERE code !~ '^[0-9]{5}$';
INSERT INTO user_support_code_reservations (code)
  SELECT support_code FROM users WHERE support_code ~ '^[0-9]{5}$'
  ON CONFLICT DO NOTHING;
ALTER TABLE user_support_code_reservations
  ADD CONSTRAINT user_support_code_reservations_format_check
  CHECK (code ~ '^[0-9]{5}$');

DO $$
BEGIN
  IF (SELECT count(*) FROM users) +
     (SELECT count(*) FROM user_support_code_reservations) > 100000 THEN
    RAISE EXCEPTION 'Not enough five-digit support codes to replace existing codes';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION allocate_user_support_code() RETURNS TEXT
LANGUAGE plpgsql VOLATILE AS $$
DECLARE
  candidate TEXT;
  reserved TEXT;
  attempt INTEGER;
BEGIN
  FOR attempt IN 1..100 LOOP
    candidate := lpad(floor(random() * 100000)::integer::text, 5, '0');
    INSERT INTO user_support_code_reservations (code) VALUES (candidate)
      ON CONFLICT DO NOTHING RETURNING code INTO reserved;
    IF FOUND THEN
      RETURN reserved;
    END IF;
  END LOOP;

  -- A small numeric namespace needs a fallback: random collisions must not
  -- prevent registration while unused codes remain. The primary key arbitrates
  -- concurrent allocations; deleted users never release their reservations.
  FOR candidate IN
    SELECT lpad(value::text, 5, '0') FROM generate_series(0, 99999) AS value
    WHERE NOT EXISTS (
      SELECT 1 FROM user_support_code_reservations
      WHERE code = lpad(value::text, 5, '0')
    )
  LOOP
    INSERT INTO user_support_code_reservations (code) VALUES (candidate)
      ON CONFLICT DO NOTHING RETURNING code INTO reserved;
    IF FOUND THEN
      RETURN reserved;
    END IF;
  END LOOP;
  RAISE EXCEPTION 'Five-digit user support code capacity exhausted';
END;
$$;

UPDATE users SET support_code = allocate_user_support_code();
ALTER TABLE users ADD CONSTRAINT users_support_code_format_check
  CHECK (support_code ~ '^[0-9]{5}$');
COMMIT;
