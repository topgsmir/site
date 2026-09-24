-- Intentionally outside a transaction. Failed concurrent builds must be dropped
-- before retrying; do not mask invalid indexes with IF NOT EXISTS.
SET lock_timeout = '5s';
CREATE INDEX CONCURRENTLY products_updated_at_id_idx ON products(updated_at DESC,id DESC);
CREATE INDEX CONCURRENTLY products_created_at_id_idx ON products(created_at DESC,id DESC);
CREATE INDEX CONCURRENTLY products_title_id_idx ON products(title,id);
CREATE INDEX CONCURRENTLY products_category_id_updated_at_id_idx ON products(category_id,updated_at DESC,id DESC);
CREATE INDEX CONCURRENTLY seller_listings_seller_id_updated_at_id_idx ON seller_listings(seller_id,updated_at DESC,id DESC);
CREATE INDEX CONCURRENTLY seller_listings_seller_id_created_at_id_idx ON seller_listings(seller_id,created_at DESC,id DESC);
