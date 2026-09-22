BEGIN;
SET LOCAL lock_timeout = '5s';

-- Keep the single URL columns for older clients and pending purchases.
ALTER TABLE "seller_offer_digital" ADD COLUMN "file_references" TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE "order_items" ADD COLUMN "digital_delivery_urls" TEXT[] NOT NULL DEFAULT '{}';
CREATE FUNCTION valid_digital_file_urls(urls TEXT[]) RETURNS BOOLEAN
LANGUAGE SQL IMMUTABLE STRICT PARALLEL SAFE AS $$
  SELECT cardinality(urls) <= 50
    AND (cardinality(urls) = 0 OR (array_ndims(urls) = 1 AND array_lower(urls, 1) = 1))
    AND NOT EXISTS (SELECT 1 FROM unnest(urls) AS u(url) WHERE url IS NULL OR length(url) NOT BETWEEN 1 AND 2048 OR url !~ '^https://');
$$;
ALTER TABLE "seller_offer_digital" ADD CONSTRAINT "seller_offer_digital_file_references_check" CHECK (valid_digital_file_urls("file_references")) NOT VALID;
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_digital_delivery_urls_check" CHECK (
  valid_digital_file_urls("digital_delivery_urls") AND (cardinality("digital_delivery_urls") = 0 OR ("product_type" = 'digital' AND "digital_delivery_url" IS NOT NULL))
) NOT VALID;

ALTER TABLE "digital_entitlements" ADD COLUMN "file_index" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "digital_entitlements" DROP CONSTRAINT "digital_entitlements_order_item_id_key";
ALTER TABLE "digital_entitlements" ADD CONSTRAINT "digital_entitlements_file_index_check" CHECK ("file_index" BETWEEN 0 AND 49);
CREATE UNIQUE INDEX "digital_entitlements_order_item_id_file_index_key" ON "digital_entitlements" ("order_item_id", "file_index");

-- Backfill after DDL: existing fulfillment constraint triggers are deferred,
-- and pending trigger events prevent subsequent ALTER TABLE operations.
-- Keep historical non-URL draft references in the legacy column for correction.
UPDATE "seller_offer_digital" SET "file_references" = ARRAY["file_reference"] WHERE "file_reference" ~ '^https://';
UPDATE "order_items" SET "digital_delivery_urls" = ARRAY["digital_delivery_url"] WHERE "digital_delivery_url" IS NOT NULL;
COMMIT;

ALTER TABLE "seller_offer_digital" VALIDATE CONSTRAINT "seller_offer_digital_file_references_check";
ALTER TABLE "order_items" VALIDATE CONSTRAINT "order_items_digital_delivery_urls_check";
