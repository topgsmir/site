CREATE TABLE "homepage_content" (
  "locale" TEXT NOT NULL PRIMARY KEY,
  "content" JSONB NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_by_id" TEXT NOT NULL,
  CONSTRAINT "homepage_content_locale_check" CHECK ("locale" IN ('fa', 'en', 'ar')),
  CONSTRAINT "homepage_content_version_check" CHECK ("version" > 0),
  CONSTRAINT "homepage_content_document_check" CHECK (jsonb_typeof("content") = 'object'),
  CONSTRAINT "homepage_content_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "homepage_content_updated_by_id_idx" ON "homepage_content"("updated_by_id");
