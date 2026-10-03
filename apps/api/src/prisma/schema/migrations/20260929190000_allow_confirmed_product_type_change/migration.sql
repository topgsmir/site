-- Keep the database guard. A conversion is valid only after all attached offers
-- have replacement fulfillment and every affected listing is unpublished.
CREATE OR REPLACE FUNCTION "prevent_product_type_change_with_offers"()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW."type" = OLD."type" THEN
    RETURN NEW;
  END IF;

  IF OLD."type" = 'bridge' OR NEW."type" = 'bridge' OR NEW."status" <> 'draft'
     OR EXISTS (SELECT 1 FROM "seller_listings" l WHERE l."product_id" = OLD."id" AND l."status" <> 'draft')
     OR EXISTS (
       SELECT 1
       FROM "seller_listings" l
       JOIN "seller_offers" o ON o."listing_id" = l."id"
       LEFT JOIN "seller_offer_digital" d ON d."offer_id" = o."id"
       LEFT JOIN "seller_offer_physical" p ON p."offer_id" = o."id"
       LEFT JOIN "seller_offer_service" s ON s."offer_id" = o."id"
       LEFT JOIN "seller_offer_bridge" b ON b."offer_id" = o."id"
       WHERE l."product_id" = OLD."id"
         AND (
           o."status" <> 'draft'
           OR EXISTS (SELECT 1 FROM "order_items" i WHERE i."offer_id" = o."id")
           OR EXISTS (SELECT 1 FROM "inventory_reservations" r WHERE r."offer_id" = o."id")
           OR b."offer_id" IS NOT NULL
           OR (NEW."type" = 'digital' AND (d."offer_id" IS NULL OR p."offer_id" IS NOT NULL OR s."offer_id" IS NOT NULL))
           OR (NEW."type" = 'physical' AND (p."offer_id" IS NULL OR d."offer_id" IS NOT NULL OR s."offer_id" IS NOT NULL))
           OR (NEW."type" = 'service' AND (s."offer_id" IS NULL OR d."offer_id" IS NOT NULL OR p."offer_id" IS NOT NULL))
         )
     ) THEN
    RAISE EXCEPTION 'Product type change requires unpublished offers with matching fulfillment and no sales or reservations';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
