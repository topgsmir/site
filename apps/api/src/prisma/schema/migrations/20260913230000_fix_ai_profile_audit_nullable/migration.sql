-- Profile lifecycle events exist before a profile is assigned to an AI capability.
-- Keep the database aligned with the nullable Prisma relation and repair profiles
-- that were committed before their audit insert failed.
ALTER TABLE "ai_audit_events"
  ALTER COLUMN "capability_key" DROP NOT NULL;

ALTER TABLE "ai_audit_events"
  DROP CONSTRAINT "ai_audit_events_capability_key_fkey",
  ADD CONSTRAINT "ai_audit_events_capability_key_fkey"
    FOREIGN KEY ("capability_key") REFERENCES "ai_capabilities"("key")
    ON DELETE SET NULL ON UPDATE CASCADE;

INSERT INTO "ai_audit_events" (
  "actor_user_id",
  "profile_id",
  "event_type",
  "metadata",
  "expires_at",
  "created_at"
)
SELECT
  profile."created_by_id",
  profile."id",
  'profile_created',
  jsonb_build_object('provider', profile."provider"),
  profile."created_at" + INTERVAL '365 days',
  profile."created_at"
FROM "ai_model_profiles" AS profile
WHERE NOT EXISTS (
  SELECT 1
  FROM "ai_audit_events" AS audit
  WHERE audit."profile_id" = profile."id"
    AND audit."event_type" = 'profile_created'
);
