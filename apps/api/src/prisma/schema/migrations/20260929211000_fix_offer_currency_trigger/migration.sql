-- Qualify the PL/pgSQL variable: product_id also names a joined column.
CREATE OR REPLACE FUNCTION "enforce_product_offer_currency"() RETURNS trigger AS $$
DECLARE expected_currency TEXT;
DECLARE target_product_id UUID;
BEGIN
  SELECT p."id", p."price_currency" INTO target_product_id, expected_currency
  FROM "seller_listings" l
  JOIN "products" p ON p."id" = l."product_id"
  WHERE l."id" = NEW."listing_id"
  FOR UPDATE OF p;
  IF expected_currency IS NULL THEN
    RAISE EXCEPTION 'Offer listing has no product' USING ERRCODE = '23514';
  END IF;
  IF BTRIM(NEW."currency") <> expected_currency AND TG_OP = 'INSERT' AND NOT EXISTS (
    SELECT 1 FROM "seller_listings" l
    JOIN "seller_offers" o ON o."listing_id" = l."id"
    WHERE l."product_id" = target_product_id
  ) AND BTRIM(NEW."currency") IN ('TOMAN', 'USD') THEN
    UPDATE "products" SET "price_currency" = BTRIM(NEW."currency") WHERE "id" = target_product_id;
    expected_currency := BTRIM(NEW."currency");
  END IF;
  IF BTRIM(NEW."currency") <> expected_currency THEN
    RAISE EXCEPTION 'Offer currency must match product price currency' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
