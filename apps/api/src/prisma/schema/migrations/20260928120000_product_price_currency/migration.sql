-- A product has one authoritative offer currency. Existing mixed products use
-- USD when present; their old toman offers remain stored for manual repricing,
-- but public reads and checkout ignore them.
SET lock_timeout = '5s';
ALTER TABLE "products" ADD COLUMN "price_currency" VARCHAR(5) NOT NULL DEFAULT 'TOMAN';

UPDATE "products" p
SET "price_currency" = 'USD'
WHERE EXISTS (
  SELECT 1 FROM "seller_listings" l
  JOIN "seller_offers" o ON o."listing_id" = l."id"
  WHERE l."product_id" = p."id" AND BTRIM(o."currency") = 'USD'
);

ALTER TABLE "products" ADD CONSTRAINT "products_price_currency_check"
  CHECK ("price_currency" IN ('TOMAN', 'USD'));

CREATE OR REPLACE FUNCTION "enforce_product_offer_currency"() RETURNS trigger AS $$
DECLARE expected_currency TEXT;
DECLARE product_id UUID;
BEGIN
  SELECT p."id", p."price_currency" INTO product_id, expected_currency
  FROM "seller_listings" l
  JOIN "products" p ON p."id" = l."product_id"
  WHERE l."id" = NEW."listing_id"
  FOR UPDATE OF p;
  IF expected_currency IS NULL THEN
    RAISE EXCEPTION 'Offer listing has no product' USING ERRCODE = '23514';
  END IF;
  -- During a rolling deploy, an older API may create the product before its
  -- first USD offer without setting the new column. Adopt that first offer.
  IF BTRIM(NEW."currency") <> expected_currency AND TG_OP = 'INSERT' AND NOT EXISTS (
    SELECT 1 FROM "seller_listings" l
    JOIN "seller_offers" o ON o."listing_id" = l."id"
    WHERE l."product_id" = product_id
  ) AND BTRIM(NEW."currency") IN ('TOMAN', 'USD') THEN
    UPDATE "products" SET "price_currency" = BTRIM(NEW."currency") WHERE "id" = product_id;
    expected_currency := BTRIM(NEW."currency");
  END IF;
  IF BTRIM(NEW."currency") <> expected_currency THEN
    RAISE EXCEPTION 'Offer currency must match product price currency' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "seller_offers_product_currency_check"
BEFORE INSERT OR UPDATE OF "currency", "listing_id" ON "seller_offers"
FOR EACH ROW EXECUTE FUNCTION "enforce_product_offer_currency"();

CREATE OR REPLACE FUNCTION "prevent_product_currency_reassignment"() RETURNS trigger AS $$
BEGIN
  IF NEW."price_currency" <> OLD."price_currency" AND EXISTS (
    SELECT 1 FROM "seller_listings" l
    JOIN "seller_offers" o ON o."listing_id" = l."id"
    WHERE l."product_id" = NEW."id"
  ) THEN
    RAISE EXCEPTION 'A product with offers cannot change price currency' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "products_price_currency_immutable"
BEFORE UPDATE OF "price_currency" ON "products"
FOR EACH ROW EXECUTE FUNCTION "prevent_product_currency_reassignment"();
RESET lock_timeout;
