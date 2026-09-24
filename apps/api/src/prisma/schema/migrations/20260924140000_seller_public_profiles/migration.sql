SET lock_timeout = '5s';
SET statement_timeout = '30s';

ALTER TABLE "sellers"
  ADD COLUMN "profile_name" VARCHAR(120),
  ADD COLUMN "profile_specialty" VARCHAR(160),
  ADD COLUMN "profile_bio" TEXT,
  ADD CONSTRAINT "sellers_profile_name_check"
    CHECK ("profile_name" IS NULL OR char_length(btrim("profile_name")) BETWEEN 2 AND 120),
  ADD CONSTRAINT "sellers_profile_specialty_check"
    CHECK ("profile_specialty" IS NULL OR char_length(btrim("profile_specialty")) BETWEEN 2 AND 160),
  ADD CONSTRAINT "sellers_profile_bio_check"
    CHECK ("profile_bio" IS NULL OR char_length(btrim("profile_bio")) BETWEEN 1 AND 1000);

RESET lock_timeout;
RESET statement_timeout;

CREATE INDEX CONCURRENTLY "sellers_public_directory_idx"
  ON "sellers" ("shop_name", "id")
  WHERE "approved" = TRUE AND "invited" = FALSE AND "suspended_at" IS NULL;
