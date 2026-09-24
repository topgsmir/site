BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '5min';

CREATE FUNCTION normalize_product_category(value text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
  SELECT lower(btrim(regexp_replace(value, '[[:space:]]+', ' ', 'g')))
$$;

CREATE TABLE product_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name varchar(100) NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 100),
  normalized_name varchar(100) NOT NULL UNIQUE,
  created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT product_categories_normalized_name_check CHECK (normalized_name = normalize_product_category(name))
);
CREATE INDEX product_categories_name_id_idx ON product_categories(name,id);
CREATE TABLE product_category_translations (
  category_id uuid NOT NULL REFERENCES product_categories(id) ON DELETE CASCADE ON UPDATE CASCADE,
  locale blog_locale NOT NULL,
  name varchar(100) NOT NULL CHECK (length(btrim(name)) BETWEEN 1 AND 100),
  PRIMARY KEY(category_id,locale)
);
ALTER TABLE products ADD COLUMN category_id uuid;
CREATE TABLE product_category_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id uuid NOT NULL REFERENCES product_categories(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  actor_user_id text NOT NULL REFERENCES users(id) ON DELETE RESTRICT ON UPDATE CASCADE,
  before_data jsonb NOT NULL,
  after_data jsonb NOT NULL,
  created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX product_category_events_category_id_created_at_id_idx ON product_category_events(category_id,created_at DESC,id DESC);
CREATE INDEX product_category_events_actor_user_id_idx ON product_category_events(actor_user_id);

-- Keep writes out during the backfill and contract step. UUID conversion and
-- this migration are deployed together during the documented maintenance window.
LOCK TABLE products IN SHARE ROW EXCLUSIVE MODE;
INSERT INTO product_categories(name,normalized_name)
SELECT DISTINCT ON (normalize_product_category(category))
  btrim(regexp_replace(category,'[[:space:]]+',' ','g')),normalize_product_category(category)
FROM products WHERE category IS NOT NULL AND normalize_product_category(category) <> ''
ORDER BY normalize_product_category(category),created_at,id;
DO $$ DECLARE affected integer; BEGIN
  LOOP
    WITH batch AS (
      SELECT p.id,c.id AS category_id FROM products p JOIN product_categories c
        ON c.normalized_name=normalize_product_category(p.category)
      WHERE p.category_id IS NULL ORDER BY p.id LIMIT 1000
    )
    UPDATE products p SET category_id=b.category_id FROM batch b WHERE p.id=b.id;
    GET DIAGNOSTICS affected = ROW_COUNT;
    EXIT WHEN affected=0;
  END LOOP;
END $$;
ALTER TABLE products ADD CONSTRAINT products_category_id_fkey
  FOREIGN KEY(category_id) REFERENCES product_categories(id) ON DELETE RESTRICT ON UPDATE CASCADE NOT VALID;
ALTER TABLE products VALIDATE CONSTRAINT products_category_id_fkey;

-- Promote unanimous existing translations into shared labels. Conflicting
-- historical labels stay intact in product_translations as display overrides;
-- they never define membership. Admins can choose a shared label explicitly.
INSERT INTO product_category_translations(category_id,locale,name)
SELECT p.category_id,t.locale,min(btrim(t.published_category))
FROM product_translations t JOIN products p ON p.id=t.product_id
WHERE p.category_id IS NOT NULL AND t.published_at IS NOT NULL
  AND length(btrim(t.published_category)) > 0
GROUP BY p.category_id,t.locale
HAVING count(DISTINCT normalize_product_category(t.published_category))=1;

-- Keep the reporting contract and its grants. CREATE OR REPLACE preserves both.
CREATE OR REPLACE VIEW ai_reporting.seller_products AS
SELECT l.seller_id,s.shop_name,l.id AS listing_id,p.id AS product_id,
       p.title AS product_title,c.name AS category,p.kind::text AS product_kind,
       p.type::text AS product_type,p.status::text AS product_status,
       l.status::text AS listing_status,o.id AS offer_id,v.name AS variant_name,
       o.price,o.currency,o.status::text AS offer_status,ph.stock,
       sv.service_type,sv.estimated_hours,l.created_at
FROM seller_listings l JOIN sellers s ON s.id=l.seller_id
JOIN products p ON p.id=l.product_id
LEFT JOIN product_categories c ON c.id=p.category_id
LEFT JOIN seller_offers o ON o.listing_id=l.id
LEFT JOIN product_variants v ON v.id=o.variant_id
LEFT JOIN seller_offer_physical ph ON ph.offer_id=o.id
LEFT JOIN seller_offer_service sv ON sv.offer_id=o.id;

ALTER TABLE products DROP COLUMN category;
COMMIT;
