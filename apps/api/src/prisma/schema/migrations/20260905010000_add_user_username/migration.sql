-- Existing users can continue signing in with email. Usernames are optional,
-- normalized to lowercase by the application, and unique when present.
ALTER TABLE "users" ADD COLUMN "username" TEXT;

CREATE UNIQUE INDEX "users_username_key" ON "users"("username");
