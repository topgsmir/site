CREATE INDEX "users_role_created_at_id_idx"
  ON "users" ("role", "created_at" DESC, "id" DESC);
