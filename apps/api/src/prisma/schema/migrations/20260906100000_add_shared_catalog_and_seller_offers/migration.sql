-- Split shared catalog data from seller-owned listings and offers. Existing
-- seller products are preserved as simple products with one default variant.
CREATE TYPE "product_kind" AS ENUM ('simple', 'variable');
CREATE TYPE "product_status" AS ENUM ('draft', 'active', 'archived');
CREATE TYPE "listing_status" AS ENUM ('draft', 'active', 'archived');

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "products"
    WHERE "base_price" < 0
       OR BTRIM("currency") !~ '^[A-Za-z]{3}$'
       OR CHAR_LENGTH(BTRIM("title")) NOT BETWEEN 2 AND 200
       OR CHAR_LENGTH(BTRIM("slug")) NOT BETWEEN 1 AND 200
  ) THEN
    RAISE EXCEPTION 'Existing products contain invalid price, currency, title, or slug data';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "products" p
    WHERE (p."type" = 'digital' AND
           (SELECT COUNT(*) FROM "product_digital" d WHERE d."product_id" = p."id") <> 1)
       OR (p."type" = 'physical' AND
           (SELECT COUNT(*) FROM "product_physical" ph WHERE ph."product_id" = p."id") <> 1)
       OR (p."type" = 'service' AND
           (SELECT COUNT(*) FROM "product_service" s WHERE s."product_id" = p."id") <> 1)
  ) THEN
    RAISE EXCEPTION 'Every existing product must have exactly one matching fulfillment record';
  END IF;
END $$;

ALTER TABLE "products"
  ADD COLUMN "created_by_seller_id" TEXT,
  ADD COLUMN "description" TEXT,
  ADD COLUMN "category" VARCHAR(100),
  ADD COLUMN "kind" "product_kind" NOT NULL DEFAULT 'simple';

UPDATE "products"
SET "created_by_seller_id" = "seller_id";

ALTER TABLE "products"
  ALTER COLUMN "created_by_seller_id" SET NOT NULL,
  ALTER COLUMN "title" TYPE VARCHAR(200),
  ALTER COLUMN "slug" TYPE VARCHAR(200),
  ALTER COLUMN "status" DROP DEFAULT,
  ALTER COLUMN "status" TYPE "product_status"
    USING (
      CASE
        WHEN "status" = 'active' THEN 'active'
        WHEN "status" = 'archived' THEN 'archived'
        ELSE 'draft'
      END
    )::"product_status",
  ALTER COLUMN "status" SET DEFAULT 'active';

CREATE TABLE "product_options" (
  "id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "name" VARCHAR(50) NOT NULL,
  "normalized_name" VARCHAR(50) NOT NULL,
  "position" INTEGER NOT NULL,
  CONSTRAINT "product_options_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "product_options_position_check" CHECK ("position" BETWEEN 0 AND 2),
  CONSTRAINT "product_options_name_check" CHECK (CHAR_LENGTH(BTRIM("name")) BETWEEN 1 AND 50)
);

CREATE TABLE "product_option_values" (
  "id" TEXT NOT NULL,
  "option_id" TEXT NOT NULL,
  "value" VARCHAR(100) NOT NULL,
  "normalized_value" VARCHAR(100) NOT NULL,
  "position" INTEGER NOT NULL,
  CONSTRAINT "product_option_values_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "product_option_values_position_check" CHECK ("position" BETWEEN 0 AND 99),
  CONSTRAINT "product_option_values_value_check" CHECK (CHAR_LENGTH(BTRIM("value")) BETWEEN 1 AND 100),
  CONSTRAINT "product_option_values_id_option_id_key" UNIQUE ("id", "option_id")
);

CREATE TABLE "product_variants" (
  "id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "name" VARCHAR(200),
  "option_signature" CHAR(64) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "product_variants_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "product_variants_name_check" CHECK ("name" IS NULL OR CHAR_LENGTH(BTRIM("name")) BETWEEN 1 AND 200),
  CONSTRAINT "product_variants_signature_check" CHECK ("option_signature" ~ '^[0-9a-f]{64}$')
);

CREATE TABLE "product_variant_values" (
  "variant_id" TEXT NOT NULL,
  "option_id" TEXT NOT NULL,
  "option_value_id" TEXT NOT NULL,
  CONSTRAINT "product_variant_values_pkey" PRIMARY KEY ("variant_id", "option_id"),
  CONSTRAINT "product_variant_values_variant_id_option_value_id_key" UNIQUE ("variant_id", "option_value_id")
);

CREATE TABLE "seller_listings" (
  "id" TEXT NOT NULL,
  "seller_id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "status" "listing_status" NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "seller_listings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "seller_offers" (
  "id" TEXT NOT NULL,
  "listing_id" TEXT NOT NULL,
  "variant_id" TEXT NOT NULL,
  "price" DECIMAL(20,4) NOT NULL,
  "currency" CHAR(3) NOT NULL,
  "seller_sku" VARCHAR(100),
  "status" "listing_status" NOT NULL DEFAULT 'active',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "seller_offers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "seller_offers_price_check" CHECK ("price" >= 0),
  CONSTRAINT "seller_offers_currency_check" CHECK ("currency" ~ '^[A-Z]{3}$'),
  CONSTRAINT "seller_offers_seller_sku_check" CHECK (
    "seller_sku" IS NULL OR CHAR_LENGTH(BTRIM("seller_sku")) BETWEEN 1 AND 100
  )
);

CREATE TABLE "seller_offer_digital" (
  "offer_id" TEXT NOT NULL,
  "file_reference" VARCHAR(512) NOT NULL,
  "max_downloads" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "seller_offer_digital_pkey" PRIMARY KEY ("offer_id"),
  CONSTRAINT "seller_offer_digital_max_downloads_check" CHECK ("max_downloads" >= 0),
  CONSTRAINT "seller_offer_digital_file_reference_check" CHECK (
    CHAR_LENGTH(BTRIM("file_reference")) BETWEEN 1 AND 512
  )
);

CREATE TABLE "seller_offer_physical" (
  "offer_id" TEXT NOT NULL,
  "weight_grams" INTEGER NOT NULL DEFAULT 0,
  "stock" INTEGER NOT NULL DEFAULT 0,
  "legacy_tracking_code" TEXT,
  "legacy_delivered_at" TIMESTAMP(3),
  CONSTRAINT "seller_offer_physical_pkey" PRIMARY KEY ("offer_id"),
  CONSTRAINT "seller_offer_physical_weight_check" CHECK ("weight_grams" >= 0),
  CONSTRAINT "seller_offer_physical_stock_check" CHECK ("stock" >= 0)
);

CREATE TABLE "seller_offer_service" (
  "offer_id" TEXT NOT NULL,
  "estimated_hours" INTEGER NOT NULL DEFAULT 1,
  "service_type" VARCHAR(100) NOT NULL,
  "instructions" TEXT,
  CONSTRAINT "seller_offer_service_pkey" PRIMARY KEY ("offer_id"),
  CONSTRAINT "seller_offer_service_estimated_hours_check" CHECK ("estimated_hours" BETWEEN 1 AND 10000),
  CONSTRAINT "seller_offer_service_type_check" CHECK (CHAR_LENGTH(BTRIM("service_type")) BETWEEN 1 AND 100),
  CONSTRAINT "seller_offer_service_instructions_check" CHECK (
    "instructions" IS NULL OR CHAR_LENGTH("instructions") <= 5000
  )
);

-- UUID-shaped deterministic identifiers let existing products be backfilled
-- without requiring a database UUID extension.
INSERT INTO "product_variants" (
  "id", "product_id", "name", "option_signature", "created_at", "updated_at"
)
SELECT
  SUBSTR(MD5('variant:' || p."id"), 1, 8) || '-' ||
  SUBSTR(MD5('variant:' || p."id"), 9, 4) || '-4' ||
  SUBSTR(MD5('variant:' || p."id"), 14, 3) || '-a' ||
  SUBSTR(MD5('variant:' || p."id"), 18, 3) || '-' ||
  SUBSTR(MD5('variant:' || p."id"), 21, 12),
  p."id",
  NULL,
  REPEAT('0', 64),
  p."created_at",
  p."updated_at"
FROM "products" p;

INSERT INTO "seller_listings" (
  "id", "seller_id", "product_id", "status", "created_at", "updated_at"
)
SELECT
  SUBSTR(MD5('listing:' || p."id"), 1, 8) || '-' ||
  SUBSTR(MD5('listing:' || p."id"), 9, 4) || '-4' ||
  SUBSTR(MD5('listing:' || p."id"), 14, 3) || '-a' ||
  SUBSTR(MD5('listing:' || p."id"), 18, 3) || '-' ||
  SUBSTR(MD5('listing:' || p."id"), 21, 12),
  p."seller_id",
  p."id",
  p."status"::TEXT::"listing_status",
  p."created_at",
  p."updated_at"
FROM "products" p;

INSERT INTO "seller_offers" (
  "id", "listing_id", "variant_id", "price", "currency", "status", "created_at", "updated_at"
)
SELECT
  SUBSTR(MD5('offer:' || p."id"), 1, 8) || '-' ||
  SUBSTR(MD5('offer:' || p."id"), 9, 4) || '-4' ||
  SUBSTR(MD5('offer:' || p."id"), 14, 3) || '-a' ||
  SUBSTR(MD5('offer:' || p."id"), 18, 3) || '-' ||
  SUBSTR(MD5('offer:' || p."id"), 21, 12),
  SUBSTR(MD5('listing:' || p."id"), 1, 8) || '-' ||
  SUBSTR(MD5('listing:' || p."id"), 9, 4) || '-4' ||
  SUBSTR(MD5('listing:' || p."id"), 14, 3) || '-a' ||
  SUBSTR(MD5('listing:' || p."id"), 18, 3) || '-' ||
  SUBSTR(MD5('listing:' || p."id"), 21, 12),
  SUBSTR(MD5('variant:' || p."id"), 1, 8) || '-' ||
  SUBSTR(MD5('variant:' || p."id"), 9, 4) || '-4' ||
  SUBSTR(MD5('variant:' || p."id"), 14, 3) || '-a' ||
  SUBSTR(MD5('variant:' || p."id"), 18, 3) || '-' ||
  SUBSTR(MD5('variant:' || p."id"), 21, 12),
  p."base_price",
  UPPER(BTRIM(p."currency")),
  p."status"::TEXT::"listing_status",
  p."created_at",
  p."updated_at"
FROM "products" p;

INSERT INTO "seller_offer_digital" ("offer_id", "file_reference", "max_downloads")
SELECT
  SUBSTR(MD5('offer:' || d."product_id"), 1, 8) || '-' ||
  SUBSTR(MD5('offer:' || d."product_id"), 9, 4) || '-4' ||
  SUBSTR(MD5('offer:' || d."product_id"), 14, 3) || '-a' ||
  SUBSTR(MD5('offer:' || d."product_id"), 18, 3) || '-' ||
  SUBSTR(MD5('offer:' || d."product_id"), 21, 12),
  d."file_reference",
  d."max_downloads"
FROM "product_digital" d;

INSERT INTO "seller_offer_physical" (
  "offer_id", "weight_grams", "stock", "legacy_tracking_code", "legacy_delivered_at"
)
SELECT
  SUBSTR(MD5('offer:' || ph."product_id"), 1, 8) || '-' ||
  SUBSTR(MD5('offer:' || ph."product_id"), 9, 4) || '-4' ||
  SUBSTR(MD5('offer:' || ph."product_id"), 14, 3) || '-a' ||
  SUBSTR(MD5('offer:' || ph."product_id"), 18, 3) || '-' ||
  SUBSTR(MD5('offer:' || ph."product_id"), 21, 12),
  ph."weight_grams",
  ph."stock",
  ph."tracking_code",
  ph."delivered_at"
FROM "product_physical" ph;

INSERT INTO "seller_offer_service" (
  "offer_id", "estimated_hours", "service_type", "instructions"
)
SELECT
  SUBSTR(MD5('offer:' || s."product_id"), 1, 8) || '-' ||
  SUBSTR(MD5('offer:' || s."product_id"), 9, 4) || '-4' ||
  SUBSTR(MD5('offer:' || s."product_id"), 14, 3) || '-a' ||
  SUBSTR(MD5('offer:' || s."product_id"), 18, 3) || '-' ||
  SUBSTR(MD5('offer:' || s."product_id"), 21, 12),
  s."estimated_hours",
  s."service_type",
  NULL
FROM "product_service" s;

CREATE UNIQUE INDEX "product_options_product_id_normalized_name_key"
  ON "product_options"("product_id", "normalized_name");
CREATE UNIQUE INDEX "product_options_id_product_id_key"
  ON "product_options"("id", "product_id");
CREATE INDEX "product_options_product_id_position_idx"
  ON "product_options"("product_id", "position");
CREATE UNIQUE INDEX "product_option_values_option_id_normalized_value_key"
  ON "product_option_values"("option_id", "normalized_value");
CREATE INDEX "product_option_values_option_id_position_idx"
  ON "product_option_values"("option_id", "position");
CREATE UNIQUE INDEX "product_variants_product_id_option_signature_key"
  ON "product_variants"("product_id", "option_signature");
CREATE INDEX "product_variants_product_id_idx" ON "product_variants"("product_id");
CREATE INDEX "product_variant_values_option_value_id_option_id_idx"
  ON "product_variant_values"("option_value_id", "option_id");
CREATE UNIQUE INDEX "seller_listings_seller_id_product_id_key"
  ON "seller_listings"("seller_id", "product_id");
CREATE INDEX "seller_listings_seller_id_status_updated_at_id_idx"
  ON "seller_listings"("seller_id", "status", "updated_at", "id");
CREATE INDEX "seller_listings_product_id_status_idx"
  ON "seller_listings"("product_id", "status");
CREATE UNIQUE INDEX "seller_offers_listing_id_variant_id_key"
  ON "seller_offers"("listing_id", "variant_id");
CREATE UNIQUE INDEX "seller_offers_listing_id_seller_sku_key"
  ON "seller_offers"("listing_id", "seller_sku");
CREATE INDEX "seller_offers_variant_id_status_price_idx"
  ON "seller_offers"("variant_id", "status", "price");
CREATE INDEX "products_created_by_seller_id_idx"
  ON "products"("created_by_seller_id");
CREATE INDEX "products_status_created_at_id_idx"
  ON "products"("status", "created_at", "id");

ALTER TABLE "product_options"
  ADD CONSTRAINT "product_options_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_option_values"
  ADD CONSTRAINT "product_option_values_option_id_fkey"
  FOREIGN KEY ("option_id") REFERENCES "product_options"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_variants"
  ADD CONSTRAINT "product_variants_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_variant_values"
  ADD CONSTRAINT "product_variant_values_variant_id_fkey"
  FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "product_variant_values"
  ADD CONSTRAINT "product_variant_values_option_value_id_option_id_fkey"
  FOREIGN KEY ("option_value_id", "option_id")
  REFERENCES "product_option_values"("id", "option_id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "seller_listings"
  ADD CONSTRAINT "seller_listings_seller_id_fkey"
  FOREIGN KEY ("seller_id") REFERENCES "sellers"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "seller_listings"
  ADD CONSTRAINT "seller_listings_product_id_fkey"
  FOREIGN KEY ("product_id") REFERENCES "products"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "seller_offers"
  ADD CONSTRAINT "seller_offers_listing_id_fkey"
  FOREIGN KEY ("listing_id") REFERENCES "seller_listings"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "seller_offers"
  ADD CONSTRAINT "seller_offers_variant_id_fkey"
  FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "seller_offer_digital"
  ADD CONSTRAINT "seller_offer_digital_offer_id_fkey"
  FOREIGN KEY ("offer_id") REFERENCES "seller_offers"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "seller_offer_physical"
  ADD CONSTRAINT "seller_offer_physical_offer_id_fkey"
  FOREIGN KEY ("offer_id") REFERENCES "seller_offers"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "seller_offer_service"
  ADD CONSTRAINT "seller_offer_service_offer_id_fkey"
  FOREIGN KEY ("offer_id") REFERENCES "seller_offers"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- An option value assigned to a variant must come from an option on that same
-- product. The composite foreign key above already guarantees that the value
-- belongs to the declared option.
CREATE FUNCTION "check_product_variant_value_match"()
RETURNS TRIGGER AS $$
DECLARE
  variant_product_id TEXT;
  option_product_id TEXT;
BEGIN
  SELECT "product_id" INTO variant_product_id
  FROM "product_variants" WHERE "id" = NEW."variant_id";
  SELECT "product_id" INTO option_product_id
  FROM "product_options" WHERE "id" = NEW."option_id";

  IF variant_product_id IS NULL OR option_product_id IS NULL OR variant_product_id <> option_product_id THEN
    RAISE EXCEPTION 'Variant option values must belong to the same product as the variant';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "product_variant_values_product_match"
BEFORE INSERT OR UPDATE OF "variant_id", "option_id", "option_value_id" ON "product_variant_values"
FOR EACH ROW EXECUTE FUNCTION "check_product_variant_value_match"();

-- The listing and selected variant must belong to the same catalog product.
CREATE FUNCTION "check_seller_offer_product_match"()
RETURNS TRIGGER AS $$
DECLARE
  listing_product_id TEXT;
  variant_product_id TEXT;
BEGIN
  SELECT "product_id" INTO listing_product_id
  FROM "seller_listings" WHERE "id" = NEW."listing_id";
  SELECT "product_id" INTO variant_product_id
  FROM "product_variants" WHERE "id" = NEW."variant_id";

  IF listing_product_id IS NULL OR variant_product_id IS NULL OR listing_product_id <> variant_product_id THEN
    RAISE EXCEPTION 'Seller offer listing and variant must belong to the same product';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "seller_offers_product_match"
BEFORE INSERT OR UPDATE OF "listing_id", "variant_id" ON "seller_offers"
FOR EACH ROW EXECUTE FUNCTION "check_seller_offer_product_match"();

-- A seller offer must have exactly one fulfillment record matching the catalog
-- product type. Deferred checks allow the offer and detail row to be inserted in
-- either order inside one transaction.
CREATE FUNCTION "check_seller_offer_fulfillment"()
RETURNS TRIGGER AS $$
DECLARE
  target_offer_id TEXT;
  expected_type "product_type";
  digital_count INTEGER;
  physical_count INTEGER;
  service_count INTEGER;
BEGIN
  IF TG_TABLE_NAME = 'seller_offers' THEN
    target_offer_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."id" ELSE NEW."id" END;
  ELSE
    target_offer_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."offer_id" ELSE NEW."offer_id" END;
  END IF;

  SELECT p."type" INTO expected_type
  FROM "seller_offers" o
  JOIN "seller_listings" l ON l."id" = o."listing_id"
  JOIN "products" p ON p."id" = l."product_id"
  WHERE o."id" = target_offer_id;

  IF expected_type IS NULL THEN
    RETURN NULL;
  END IF;

  SELECT COUNT(*) INTO digital_count FROM "seller_offer_digital" WHERE "offer_id" = target_offer_id;
  SELECT COUNT(*) INTO physical_count FROM "seller_offer_physical" WHERE "offer_id" = target_offer_id;
  SELECT COUNT(*) INTO service_count FROM "seller_offer_service" WHERE "offer_id" = target_offer_id;

  IF (expected_type = 'digital' AND (digital_count <> 1 OR physical_count <> 0 OR service_count <> 0))
     OR (expected_type = 'physical' AND (digital_count <> 0 OR physical_count <> 1 OR service_count <> 0))
     OR (expected_type = 'service' AND (digital_count <> 0 OR physical_count <> 0 OR service_count <> 1)) THEN
    RAISE EXCEPTION 'Seller offer fulfillment data does not match its product type';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "seller_offers_fulfillment_check"
AFTER INSERT OR UPDATE ON "seller_offers"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "check_seller_offer_fulfillment"();
CREATE CONSTRAINT TRIGGER "seller_offer_digital_fulfillment_check"
AFTER INSERT OR UPDATE OR DELETE ON "seller_offer_digital"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "check_seller_offer_fulfillment"();
CREATE CONSTRAINT TRIGGER "seller_offer_physical_fulfillment_check"
AFTER INSERT OR UPDATE OR DELETE ON "seller_offer_physical"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "check_seller_offer_fulfillment"();
CREATE CONSTRAINT TRIGGER "seller_offer_service_fulfillment_check"
AFTER INSERT OR UPDATE OR DELETE ON "seller_offer_service"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION "check_seller_offer_fulfillment"();

CREATE FUNCTION "prevent_product_type_change_with_offers"()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."type" <> OLD."type" AND EXISTS (
    SELECT 1
    FROM "seller_listings" l
    JOIN "seller_offers" o ON o."listing_id" = l."id"
    WHERE l."product_id" = OLD."id"
  ) THEN
    RAISE EXCEPTION 'A product type cannot change after seller offers exist';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "products_prevent_type_change"
BEFORE UPDATE OF "type" ON "products"
FOR EACH ROW EXECUTE FUNCTION "prevent_product_type_change_with_offers"();

ALTER TABLE "products" DROP CONSTRAINT "products_seller_id_fkey";
ALTER TABLE "products"
  ADD CONSTRAINT "products_created_by_seller_id_fkey"
  FOREIGN KEY ("created_by_seller_id") REFERENCES "sellers"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

DROP TABLE "product_digital";
DROP TABLE "product_physical";
DROP TABLE "product_service";

ALTER TABLE "products"
  DROP COLUMN "seller_id",
  DROP COLUMN "base_price",
  DROP COLUMN "currency";

ALTER TABLE "products"
  ADD CONSTRAINT "products_title_check" CHECK (CHAR_LENGTH(BTRIM("title")) BETWEEN 2 AND 200),
  ADD CONSTRAINT "products_slug_check" CHECK (CHAR_LENGTH(BTRIM("slug")) BETWEEN 1 AND 200),
  ADD CONSTRAINT "products_description_check" CHECK ("description" IS NULL OR CHAR_LENGTH("description") <= 10000),
  ADD CONSTRAINT "products_category_check" CHECK ("category" IS NULL OR CHAR_LENGTH(BTRIM("category")) BETWEEN 1 AND 100);
