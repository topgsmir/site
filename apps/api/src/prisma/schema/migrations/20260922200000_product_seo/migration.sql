BEGIN;
SET LOCAL lock_timeout = '10s';

CREATE TABLE product_slug_routes (
  slug text PRIMARY KEY CHECK (length(slug) BETWEEN 1 AND 200),
  product_id text NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  created_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX product_slug_routes_product_id_idx ON product_slug_routes(product_id);

-- Serialize the backfill with inserts/renames; fail quickly instead of queuing writes.
LOCK TABLE products IN SHARE ROW EXCLUSIVE MODE;
INSERT INTO product_slug_routes(slug, product_id) SELECT slug, id FROM products;

CREATE FUNCTION reserve_product_slug() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE owner_id text;
BEGIN
  INSERT INTO product_slug_routes(slug, product_id) VALUES (NEW.slug, NEW.id)
    ON CONFLICT (slug) DO NOTHING;
  SELECT product_id INTO owner_id FROM product_slug_routes WHERE slug = NEW.slug;
  IF owner_id IS DISTINCT FROM NEW.id THEN
    RAISE EXCEPTION 'Product slug is already reserved' USING ERRCODE = '23505', CONSTRAINT = 'product_slug_routes_pkey';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER reserve_product_slug AFTER INSERT OR UPDATE OF slug ON products
  FOR EACH ROW EXECUTE FUNCTION reserve_product_slug();

CREATE TABLE product_translations (
  product_id text NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  locale blog_locale NOT NULL CHECK (locale IN ('en', 'ar')),
  draft_title text NOT NULL DEFAULT '' CHECK (length(draft_title) <= 200),
  draft_description text NOT NULL DEFAULT '' CHECK (length(draft_description) <= 10000),
  draft_category text CHECK (length(draft_category) <= 100),
  published_title text,
  published_description text,
  published_category text CHECK (length(published_category) <= 100),
  published_at timestamptz(3),
  updated_at timestamptz(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_by text NOT NULL,
  PRIMARY KEY (product_id, locale),
  CHECK ((published_at IS NULL AND published_title IS NULL AND published_description IS NULL AND published_category IS NULL)
    OR (published_at IS NOT NULL AND published_title IS NOT NULL AND published_description IS NOT NULL
      AND length(trim(published_title)) BETWEEN 2 AND 200 AND length(trim(published_description)) BETWEEN 1 AND 10000))
);
CREATE INDEX product_translations_locale_published_at_product_id_idx ON product_translations(locale, published_at, product_id);
COMMIT;
