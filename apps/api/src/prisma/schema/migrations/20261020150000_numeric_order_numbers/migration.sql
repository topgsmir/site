BEGIN;
SET LOCAL lock_timeout = '5s';
ALTER TABLE orders ADD COLUMN order_number BIGINT;
CREATE SEQUENCE orders_order_number_seq START WITH 100001 OWNED BY orders.order_number;
WITH numbered AS (
  SELECT id, 100000 + row_number() OVER (ORDER BY created_at, id) AS number FROM orders
)
UPDATE orders SET order_number = numbered.number FROM numbered WHERE orders.id = numbered.id;
SELECT setval('orders_order_number_seq', COALESCE((SELECT MAX(order_number) + 1 FROM orders), 100001), false);
ALTER TABLE orders ALTER COLUMN order_number SET DEFAULT nextval('orders_order_number_seq');
ALTER TABLE orders ALTER COLUMN order_number SET NOT NULL;
ALTER TABLE orders ADD CONSTRAINT orders_order_number_positive CHECK (order_number > 0);
CREATE UNIQUE INDEX orders_order_number_key ON orders(order_number);
COMMIT;
