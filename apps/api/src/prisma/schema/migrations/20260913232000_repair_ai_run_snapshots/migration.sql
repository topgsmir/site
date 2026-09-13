-- The original AI-platform migration was already applied before run snapshots
-- were added to its SQL. Add them forward-only and backfill any legacy runs
-- from the profile that was referenced when the run was created.
ALTER TABLE "ai_runs"
  ADD COLUMN IF NOT EXISTS "provider_snapshot" "ai_provider",
  ADD COLUMN IF NOT EXISTS "model_id_snapshot" VARCHAR(200),
  ADD COLUMN IF NOT EXISTS "base_url_snapshot" VARCHAR(500);

UPDATE "ai_runs" AS run
SET
  "provider_snapshot" = profile."provider",
  "model_id_snapshot" = profile."model_id",
  "base_url_snapshot" = profile."base_url"
FROM "ai_model_profiles" AS profile
WHERE run."profile_id" = profile."id"
  AND (
    run."provider_snapshot" IS NULL
    OR run."model_id_snapshot" IS NULL
    OR run."base_url_snapshot" IS NULL
  );

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "ai_runs"
    WHERE "provider_snapshot" IS NULL
      OR "model_id_snapshot" IS NULL
      OR "base_url_snapshot" IS NULL
  ) THEN
    RAISE EXCEPTION 'Cannot enforce AI run snapshots: one or more runs could not be backfilled';
  END IF;
END
$$;

ALTER TABLE "ai_runs"
  ALTER COLUMN "provider_snapshot" SET NOT NULL,
  ALTER COLUMN "model_id_snapshot" SET NOT NULL,
  ALTER COLUMN "base_url_snapshot" SET NOT NULL;

ALTER TABLE "ai_runs"
  DROP CONSTRAINT "ai_runs_input_message_id_fkey",
  ADD CONSTRAINT "ai_runs_input_message_id_fkey"
    FOREIGN KEY ("input_message_id") REFERENCES "ai_messages"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
