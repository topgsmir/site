-- Nullable keeps this migration compatible with existing users. Accounts without
-- a hash cannot sign in until a password is provisioned for them.
ALTER TABLE "users" ADD COLUMN "password_hash" TEXT;
