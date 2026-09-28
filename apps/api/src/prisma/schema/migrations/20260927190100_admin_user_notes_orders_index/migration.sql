CREATE INDEX CONCURRENTLY orders_seller_buyer_created_idx ON orders(seller_id, buyer_id, created_at DESC, id DESC);
