CREATE TABLE "auth_sessions" (
  "id" TEXT NOT NULL,
  "token_hash" CHAR(64) NOT NULL,
  "user_id" TEXT NOT NULL,
  "expires_at" TIMESTAMP(3) NOT NULL,
  "revoked_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "auth_sessions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "auth_sessions_token_hash_check" CHECK ("token_hash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "auth_sessions_expiry_check" CHECK ("expires_at" > "created_at"),
  CONSTRAINT "auth_sessions_revocation_check" CHECK (
    "revoked_at" IS NULL OR "revoked_at" >= "created_at"
  )
);

CREATE TABLE "auth_rate_limits" (
  "key_hash" CHAR(64) NOT NULL,
  "action" VARCHAR(32) NOT NULL,
  "window_started_at" TIMESTAMP(3) NOT NULL,
  "attempt_count" INTEGER NOT NULL,
  "blocked_until" TIMESTAMP(3),
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "auth_rate_limits_pkey" PRIMARY KEY ("key_hash"),
  CONSTRAINT "auth_rate_limits_key_hash_check" CHECK ("key_hash" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "auth_rate_limits_action_check" CHECK ("action" IN ('login', 'register')),
  CONSTRAINT "auth_rate_limits_attempt_count_check" CHECK ("attempt_count" >= 1),
  CONSTRAINT "auth_rate_limits_blocked_until_check" CHECK (
    "blocked_until" IS NULL OR "blocked_until" >= "window_started_at"
  )
);

CREATE UNIQUE INDEX "auth_sessions_token_hash_key" ON "auth_sessions"("token_hash");
CREATE INDEX "auth_sessions_user_id_revoked_at_idx" ON "auth_sessions"("user_id", "revoked_at");
CREATE INDEX "auth_sessions_expires_at_idx" ON "auth_sessions"("expires_at");
CREATE INDEX "auth_rate_limits_updated_at_idx" ON "auth_rate_limits"("updated_at");

ALTER TABLE "auth_sessions" ADD CONSTRAINT "auth_sessions_user_id_fkey"
  FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
