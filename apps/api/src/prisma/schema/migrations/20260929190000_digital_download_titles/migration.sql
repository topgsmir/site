ALTER TABLE seller_offer_digital ADD COLUMN file_titles TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE order_items ADD COLUMN digital_delivery_titles TEXT[] NOT NULL DEFAULT '{}';

ALTER TABLE seller_offer_digital ADD CONSTRAINT seller_offer_digital_file_titles_count_check
  CHECK (cardinality(file_titles) = 0 OR cardinality(file_titles) = cardinality(file_references));
ALTER TABLE order_items ADD CONSTRAINT order_items_digital_delivery_titles_count_check
  CHECK (cardinality(digital_delivery_titles) = 0 OR cardinality(digital_delivery_titles) = cardinality(digital_delivery_urls));
