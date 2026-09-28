-- Reserve codes independently of users so deleted accounts never release a code.
CREATE TABLE user_support_code_reservations (
  code TEXT PRIMARY KEY,
  CONSTRAINT user_support_code_reservations_format_check
    CHECK (code ~ '^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{5}$')
);

CREATE FUNCTION allocate_user_support_code() RETURNS TEXT
LANGUAGE plpgsql VOLATILE AS $$
DECLARE
  alphabet CONSTANT TEXT := '23456789ABCDEFGHJKMNPQRSTUVWXYZ';
  random_bytes BYTEA;
  candidate TEXT;
  reserved TEXT;
  position INTEGER;
  attempt INTEGER;
BEGIN
  FOR attempt IN 1..100 LOOP
    random_bytes := decode(replace(gen_random_uuid()::text, '-', ''), 'hex');
    candidate := '';
    FOR position IN 0..4 LOOP
      candidate := candidate || substr(alphabet, get_byte(random_bytes, position) % 31 + 1, 1);
    END LOOP;
    INSERT INTO user_support_code_reservations (code) VALUES (candidate)
      ON CONFLICT DO NOTHING RETURNING code INTO reserved;
    IF FOUND THEN
      RETURN reserved;
    END IF;
  END LOOP;
  RAISE EXCEPTION 'Unable to allocate a user support code';
END;
$$;

ALTER TABLE users ADD COLUMN support_code TEXT;
ALTER TABLE users ALTER COLUMN support_code SET DEFAULT allocate_user_support_code();
UPDATE users SET support_code = allocate_user_support_code();
ALTER TABLE users ALTER COLUMN support_code SET NOT NULL;
ALTER TABLE users ADD CONSTRAINT users_support_code_format_check
  CHECK (support_code ~ '^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{5}$');
CREATE UNIQUE INDEX users_support_code_key ON users (support_code);
