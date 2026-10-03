ALTER TABLE "users" ADD COLUMN "pending_phone_number" VARCHAR(16);
CREATE UNIQUE INDEX CONCURRENTLY "users_pending_phone_number_key" ON "users"("pending_phone_number");
