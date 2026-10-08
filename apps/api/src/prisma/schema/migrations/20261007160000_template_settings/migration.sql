CREATE TABLE "template_settings" (
  "locale" TEXT NOT NULL,
  "configuration" JSONB NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_by_id" TEXT NOT NULL,
  CONSTRAINT "template_settings_pkey" PRIMARY KEY ("locale"),
  CONSTRAINT "template_settings_locale_check" CHECK ("locale" IN ('fa', 'en', 'ar')),
  CONSTRAINT "template_settings_version_check" CHECK ("version" > 0),
  CONSTRAINT "template_settings_configuration_check" CHECK (jsonb_typeof("configuration") = 'object' AND octet_length("configuration"::text) <= 65536),
  CONSTRAINT "template_settings_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "template_settings_updated_by_id_idx" ON "template_settings"("updated_by_id");
