BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '5min';

ALTER TABLE product_categories
  ADD COLUMN slug varchar(160),
  ADD COLUMN description varchar(4000),
  ADD COLUMN meta_title varchar(160),
  ADD COLUMN meta_description varchar(320),
  ADD COLUMN parent_id uuid,
  ADD COLUMN image_data bytea,
  ADD COLUMN image_updated_at timestamptz(3);

-- Existing categories have no public URL. Give each a stable, collision-free
-- slug without guessing how names in different scripts should be transliterated.
UPDATE product_categories SET slug = 'category-' || id::text;
ALTER TABLE product_categories ALTER COLUMN slug SET DEFAULT ('category-' || gen_random_uuid()::text);
ALTER TABLE product_categories ALTER COLUMN slug SET NOT NULL;
ALTER TABLE product_categories ADD CONSTRAINT product_categories_slug_key UNIQUE (slug);
ALTER TABLE product_categories ADD CONSTRAINT product_categories_parent_id_fkey
  FOREIGN KEY (parent_id) REFERENCES product_categories(id) ON DELETE RESTRICT NOT VALID;
ALTER TABLE product_categories VALIDATE CONSTRAINT product_categories_parent_id_fkey;
ALTER TABLE product_categories ADD CONSTRAINT product_categories_not_own_parent
  CHECK (parent_id IS DISTINCT FROM id);
CREATE INDEX product_categories_parent_id_name_id_idx ON product_categories(parent_id, name, id);

-- Keep category audit history after deletion. The before/after JSON retains
-- the deleted category ID and fields while the relational pointer is cleared.
ALTER TABLE product_category_events DROP CONSTRAINT product_category_events_category_id_fkey;
ALTER TABLE product_category_events ALTER COLUMN category_id DROP NOT NULL;
ALTER TABLE product_category_events ADD CONSTRAINT product_category_events_category_id_fkey
  FOREIGN KEY (category_id) REFERENCES product_categories(id) ON DELETE SET NULL NOT VALID;
ALTER TABLE product_category_events VALIDATE CONSTRAINT product_category_events_category_id_fkey;

COMMIT;
