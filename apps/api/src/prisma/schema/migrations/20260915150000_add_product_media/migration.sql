CREATE TABLE "product_media_assets" (
  "id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "uploaded_by_user_id" TEXT NOT NULL,
  "width" INTEGER NOT NULL,
  "height" INTEGER NOT NULL,
  "byte_size" INTEGER NOT NULL,
  "checksum" CHAR(64) NOT NULL,
  "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "product_media_assets_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "product_media_assets_dimensions_check" CHECK (
    "width" > 0 AND "height" > 0 AND "width"::bigint * "height"::bigint <= 24000000
  ),
  CONSTRAINT "product_media_assets_size_check" CHECK (
    "byte_size" > 0 AND "byte_size" <= 8388608
  )
);

CREATE TABLE "product_media_variants" (
  "asset_id" TEXT NOT NULL,
  "variant" VARCHAR(20) NOT NULL,
  "width" INTEGER NOT NULL,
  "height" INTEGER NOT NULL,
  "byte_size" INTEGER NOT NULL,
  "path" VARCHAR(512) NOT NULL,
  CONSTRAINT "product_media_variants_pkey" PRIMARY KEY ("asset_id", "variant"),
  CONSTRAINT "product_media_variants_dimensions_check" CHECK ("width" > 0 AND "height" > 0),
  CONSTRAINT "product_media_variants_size_check" CHECK ("byte_size" > 0),
  CONSTRAINT "product_media_variants_path_key" UNIQUE ("path")
);

CREATE UNIQUE INDEX "product_media_assets_product_id_key"
  ON "product_media_assets"("product_id");
CREATE INDEX "product_media_assets_uploaded_by_user_id_idx"
  ON "product_media_assets"("uploaded_by_user_id");

ALTER TABLE "product_media_assets"
  ADD CONSTRAINT "product_media_assets_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "product_media_assets"
  ADD CONSTRAINT "product_media_assets_uploaded_by_user_id_fkey"
  FOREIGN KEY ("uploaded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "product_media_variants"
  ADD CONSTRAINT "product_media_variants_asset_id_fkey"
  FOREIGN KEY ("asset_id") REFERENCES "product_media_assets"("id") ON DELETE CASCADE ON UPDATE CASCADE;
