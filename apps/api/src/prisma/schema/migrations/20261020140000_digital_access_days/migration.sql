ALTER TABLE seller_offer_digital ADD COLUMN access_days INTEGER NOT NULL DEFAULT 0 CHECK (access_days BETWEEN 0 AND 36500);
ALTER TABLE order_items ADD COLUMN digital_access_days INTEGER NOT NULL DEFAULT 0 CHECK (digital_access_days BETWEEN 0 AND 36500);
