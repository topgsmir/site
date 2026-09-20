CREATE TABLE "admin_user_profile_changes" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" TEXT NOT NULL,
    "actor_user_id" TEXT NOT NULL,
    "before_data" JSONB NOT NULL,
    "after_data" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "admin_user_profile_changes_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "admin_user_profile_changes_user_id_created_at_id_idx"
ON "admin_user_profile_changes"("user_id", "created_at" DESC, "id" DESC);

ALTER TABLE "admin_user_profile_changes" ADD CONSTRAINT "admin_user_profile_changes_user_id_fkey"
FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "admin_user_profile_changes" ADD CONSTRAINT "admin_user_profile_changes_actor_user_id_fkey"
FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
