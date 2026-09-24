CREATE TABLE "homepage_stories" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "locale" "blog_locale" NOT NULL,
  "title" VARCHAR(80) NOT NULL,
  "target_url" VARCHAR(2048) NOT NULL,
  "position" INTEGER NOT NULL DEFAULT 0,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "image_path" VARCHAR(512) NOT NULL,
  "image_width" INTEGER NOT NULL,
  "image_height" INTEGER NOT NULL,
  "image_byte_size" INTEGER NOT NULL,
  "image_checksum" CHAR(64) NOT NULL,
  "original_filename" VARCHAR(255),
  "original_mime_type" VARCHAR(100),
  "created_by_id" TEXT NOT NULL,
  "updated_by_id" TEXT NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "homepage_stories_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "homepage_stories_title_check" CHECK (char_length(btrim("title")) BETWEEN 1 AND 80),
  CONSTRAINT "homepage_stories_position_check" CHECK ("position" BETWEEN 0 AND 10000),
  CONSTRAINT "homepage_stories_image_dimensions_check" CHECK ("image_width" > 0 AND "image_height" > 0),
  CONSTRAINT "homepage_stories_image_byte_size_check" CHECK ("image_byte_size" > 0),
  CONSTRAINT "homepage_stories_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "homepage_stories_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "homepage_stories_image_path_key" ON "homepage_stories"("image_path");
CREATE INDEX "homepage_stories_locale_enabled_position_created_at_id_idx" ON "homepage_stories"("locale", "enabled", "position", "created_at", "id");
CREATE INDEX "homepage_stories_created_by_id_idx" ON "homepage_stories"("created_by_id");
CREATE INDEX "homepage_stories_updated_by_id_idx" ON "homepage_stories"("updated_by_id");
