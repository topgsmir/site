CREATE TABLE "seller_profile_media_assets" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "seller_id" TEXT NOT NULL,
  "uploaded_by_user_id" TEXT NOT NULL,
  "width" INTEGER NOT NULL,
  "height" INTEGER NOT NULL,
  "byte_size" INTEGER NOT NULL,
  "checksum" CHAR(64) NOT NULL,
  "path" VARCHAR(512) NOT NULL,
  "original_filename" VARCHAR(255),
  "original_mime_type" VARCHAR(100),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "seller_profile_media_assets_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "seller_profile_media_assets_dimensions_check" CHECK ("width" > 0 AND "height" > 0 AND "byte_size" > 0),
  CONSTRAINT "seller_profile_media_assets_checksum_check" CHECK ("checksum" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "seller_profile_media_assets_owner_path_check" CHECK (
    "path" = 'sellers/' || "seller_id" || '/profile/' || "id"::text || '.webp'
  ),
  CONSTRAINT "seller_profile_media_assets_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "seller_profile_media_assets_uploaded_by_user_id_fkey" FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "seller_profile_media_assets_seller_id_key" ON "seller_profile_media_assets"("seller_id");
CREATE UNIQUE INDEX "seller_profile_media_assets_path_key" ON "seller_profile_media_assets"("path");
CREATE INDEX "seller_profile_media_assets_uploaded_by_user_id_idx" ON "seller_profile_media_assets"("uploaded_by_user_id");
