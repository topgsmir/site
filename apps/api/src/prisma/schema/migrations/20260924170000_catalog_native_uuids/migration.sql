-- Coordinate this atomic table rewrite with a maintenance deployment. See docs/catalog-migration.md.
BEGIN;
SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '5min';
SET LOCAL search_path = public, pg_temp;

CREATE TEMP TABLE catalog_uuid_columns (table_name text, column_name text, PRIMARY KEY(table_name,column_name)) ON COMMIT DROP;
INSERT INTO catalog_uuid_columns VALUES
  ('products', 'id'),
  ('product_options', 'id'),
  ('product_options', 'product_id'),
  ('product_option_values', 'id'),
  ('product_option_values', 'option_id'),
  ('product_variants', 'id'),
  ('product_variants', 'product_id'),
  ('seller_listings', 'id'),
  ('seller_listings', 'product_id'),
  ('seller_offers', 'id'),
  ('seller_offers', 'listing_id'),
  ('seller_offers', 'variant_id'),
  ('blog_posts', 'product_id'),
  ('blog_revision_products', 'product_id'),
  ('product_slug_routes', 'product_id'),
  ('product_translations', 'product_id'),
  ('product_media_assets', 'product_id'),
  ('product_media_assets', 'restore_product_id'),
  ('product_change_events', 'product_id'),
  ('product_review_events', 'product_id'),
  ('product_variant_values', 'variant_id'),
  ('product_variant_values', 'option_value_id'),
  ('product_variant_values', 'option_id'),
  ('seller_offer_digital', 'offer_id'),
  ('seller_offer_physical', 'offer_id'),
  ('seller_offer_service', 'offer_id'),
  ('seller_offer_bridge', 'offer_id'),
  ('order_items', 'offer_id'),
  ('bridge_product_bindings', 'product_id'),
  ('inventory_reservations', 'offer_id'),
  ('comments', 'product_id');

-- Acquire all locks before inspecting dependencies or data. A failure rolls back
-- the entire conversion; existing identifiers are never replaced or regenerated.
DO $$ DECLARE r record; bad boolean; BEGIN
  FOR r IN SELECT DISTINCT table_name FROM catalog_uuid_columns ORDER BY table_name LOOP
    EXECUTE format('LOCK TABLE %I IN ACCESS EXCLUSIVE MODE', r.table_name);
  END LOOP;
  FOR r IN SELECT * FROM catalog_uuid_columns LOOP
    EXECUTE format('SELECT EXISTS (SELECT 1 FROM %I WHERE %I IS NOT NULL AND %I::text !~* %L)',
      r.table_name, r.column_name, r.column_name, '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') INTO bad;
    IF bad THEN RAISE EXCEPTION 'Non-UUID data in %.%; repair identifiers before migration', r.table_name,r.column_name; END IF;
  END LOOP;
END $$;

-- Preserve the deployed view definitions, owners and grants rather than copying
-- historical definitions that may have changed in subsequent migrations.
CREATE TEMP TABLE catalog_saved_views ON COMMIT DROP AS
SELECT c.oid, n.nspname, c.relname, pg_get_viewdef(c.oid,true) AS definition,
       pg_get_userbyid(c.relowner) AS owner_name, c.reloptions,
       obj_description(c.oid,'pg_class') AS comment
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='ai_reporting' AND c.relkind='v';
CREATE TEMP TABLE catalog_saved_grants ON COMMIT DROP AS
SELECT v.nspname,v.relname, CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END AS grantee,
       a.privilege_type,a.is_grantable
FROM catalog_saved_views v JOIN pg_class c ON c.oid=v.oid
CROSS JOIN LATERAL aclexplode(coalesce(c.relacl,acldefault('r',c.relowner))) a;

CREATE TEMP TABLE catalog_saved_triggers ON COMMIT DROP AS
SELECT t.tgname,c.relname,pg_get_triggerdef(t.oid,true) AS definition,t.tgenabled
FROM pg_trigger t JOIN pg_class c ON c.oid=t.tgrelid JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND NOT t.tgisinternal
  AND c.relname IN (SELECT table_name FROM catalog_uuid_columns);
CREATE TEMP TABLE catalog_saved_fks ON COMMIT DROP AS
SELECT DISTINCT c.conrelid::regclass::text AS table_name,c.conname,
       pg_get_constraintdef(c.oid) AS definition,c.convalidated
FROM pg_constraint c
WHERE c.contype='f' AND EXISTS (
  SELECT 1 FROM catalog_uuid_columns u JOIN pg_attribute a
    ON a.attrelid=to_regclass('public.'||quote_ident(u.table_name)) AND a.attname=u.column_name
  WHERE (c.conrelid=a.attrelid AND a.attnum=ANY(c.conkey))
     OR (c.confrelid=a.attrelid AND a.attnum=ANY(c.confkey))
);

DO $$ DECLARE r record; BEGIN
  -- All repository reporting views are independent. Unexpected dependencies
  -- intentionally fail without CASCADE, preserving unreviewed database objects.
  FOR r IN SELECT * FROM catalog_saved_views LOOP EXECUTE format('DROP VIEW %I.%I',r.nspname,r.relname); END LOOP;
  FOR r IN SELECT * FROM catalog_saved_triggers LOOP EXECUTE format('DROP TRIGGER %I ON %I',r.tgname,r.relname); END LOOP;
  FOR r IN SELECT * FROM catalog_saved_fks LOOP EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I',r.table_name,r.conname); END LOOP;
END $$;

DO $$ DECLARE r record; d record; BEGIN
  FOR d IN
    SELECT u.*,pg_get_expr(ad.adbin,ad.adrelid) AS expression
    FROM catalog_uuid_columns u JOIN pg_attribute a
      ON a.attrelid=to_regclass('public.'||quote_ident(u.table_name)) AND a.attname=u.column_name
    JOIN pg_attrdef ad ON ad.adrelid=a.attrelid AND ad.adnum=a.attnum
  LOOP
    EXECUTE format('ALTER TABLE %I ALTER COLUMN %I SET DEFAULT (%s)::uuid',d.table_name,d.column_name,d.expression);
  END LOOP;
  FOR r IN SELECT table_name,string_agg(format('ALTER COLUMN %I TYPE uuid USING %I::uuid',column_name,column_name),', ' ORDER BY column_name) AS changes
    FROM catalog_uuid_columns GROUP BY table_name ORDER BY table_name
  LOOP EXECUTE format('ALTER TABLE %I %s',r.table_name,r.changes); END LOOP;
END $$;

-- PL/pgSQL locals must have the same types as the converted columns.
CREATE OR REPLACE FUNCTION "check_product_variant_value_match"()
RETURNS TRIGGER AS $$
DECLARE
  variant_product_id uuid;
  option_product_id uuid;
BEGIN
  SELECT "product_id" INTO variant_product_id
  FROM "product_variants" WHERE "id" = NEW."variant_id";
  SELECT "product_id" INTO option_product_id
  FROM "product_options" WHERE "id" = NEW."option_id";

  IF variant_product_id IS NULL OR option_product_id IS NULL OR variant_product_id <> option_product_id THEN
    RAISE EXCEPTION 'Variant option values must belong to the same product as the variant';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "check_seller_offer_product_match"()
RETURNS TRIGGER AS $$
DECLARE
  listing_product_id uuid;
  variant_product_id uuid;
BEGIN
  SELECT "product_id" INTO listing_product_id
  FROM "seller_listings" WHERE "id" = NEW."listing_id";
  SELECT "product_id" INTO variant_product_id
  FROM "product_variants" WHERE "id" = NEW."variant_id";

  IF listing_product_id IS NULL OR variant_product_id IS NULL OR listing_product_id <> variant_product_id THEN
    RAISE EXCEPTION 'Seller offer listing and variant must belong to the same product';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "check_seller_offer_fulfillment"() RETURNS TRIGGER AS $$
DECLARE
  target_offer_id uuid;
  expected_type "product_type";
  digital_count INTEGER;
  physical_count INTEGER;
  service_count INTEGER;
  bridge_count INTEGER;
BEGIN
  IF TG_TABLE_NAME = 'seller_offers' THEN
    target_offer_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."id" ELSE NEW."id" END;
  ELSE
    target_offer_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."offer_id" ELSE NEW."offer_id" END;
  END IF;
  SELECT p."type" INTO expected_type
  FROM "seller_offers" o
  JOIN "seller_listings" l ON l."id" = o."listing_id"
  JOIN "products" p ON p."id" = l."product_id"
  WHERE o."id" = target_offer_id;
  IF expected_type IS NULL THEN RETURN NULL; END IF;
  SELECT COUNT(*) INTO digital_count FROM "seller_offer_digital" WHERE "offer_id" = target_offer_id;
  SELECT COUNT(*) INTO physical_count FROM "seller_offer_physical" WHERE "offer_id" = target_offer_id;
  SELECT COUNT(*) INTO service_count FROM "seller_offer_service" WHERE "offer_id" = target_offer_id;
  SELECT COUNT(*) INTO bridge_count FROM "seller_offer_bridge" WHERE "offer_id" = target_offer_id;
  IF (expected_type = 'digital' AND (digital_count <> 1 OR physical_count <> 0 OR service_count <> 0 OR bridge_count <> 0))
     OR (expected_type = 'physical' AND (digital_count <> 0 OR physical_count <> 1 OR service_count <> 0 OR bridge_count <> 0))
     OR (expected_type = 'service' AND (digital_count <> 0 OR physical_count <> 0 OR service_count <> 1 OR bridge_count <> 0))
     OR (expected_type = 'bridge' AND (digital_count <> 0 OR physical_count <> 0 OR service_count <> 0 OR bridge_count <> 1)) THEN
    RAISE EXCEPTION 'Seller offer fulfillment data does not match its product type';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION reserve_product_slug() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE owner_id uuid;
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

DO $$ DECLARE r record; grantee record; BEGIN
  FOR r IN SELECT * FROM catalog_saved_fks LOOP
    EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I %s',r.table_name,r.conname,r.definition);
  END LOOP;
  FOR r IN SELECT * FROM catalog_saved_triggers LOOP
    EXECUTE r.definition;
    IF r.tgenabled='D' THEN EXECUTE format('ALTER TABLE %I DISABLE TRIGGER %I',r.relname,r.tgname);
    ELSIF r.tgenabled='R' THEN EXECUTE format('ALTER TABLE %I ENABLE REPLICA TRIGGER %I',r.relname,r.tgname);
    ELSIF r.tgenabled='A' THEN EXECUTE format('ALTER TABLE %I ENABLE ALWAYS TRIGGER %I',r.relname,r.tgname); END IF;
  END LOOP;
  FOR r IN SELECT * FROM catalog_saved_views LOOP
    EXECUTE format('CREATE VIEW %I.%I %s AS %s',r.nspname,r.relname,
      CASE WHEN r.reloptions IS NULL THEN '' ELSE 'WITH ('||array_to_string(r.reloptions,', ')||')' END,r.definition);
    EXECUTE format('ALTER VIEW %I.%I OWNER TO %I',r.nspname,r.relname,r.owner_name);
    -- Remove grants inherited from current default privileges before replaying
    -- the original ACL; recreation must not broaden access to reporting data.
    FOR grantee IN
      SELECT DISTINCT CASE WHEN a.grantee=0 THEN 'PUBLIC' ELSE pg_get_userbyid(a.grantee) END AS name
      FROM pg_class c CROSS JOIN LATERAL aclexplode(c.relacl) a
      WHERE c.oid=to_regclass(format('%I.%I',r.nspname,r.relname))
    LOOP
      EXECUTE format('REVOKE ALL ON %I.%I FROM %s',r.nspname,r.relname,
        CASE WHEN grantee.name='PUBLIC' THEN 'PUBLIC' ELSE quote_ident(grantee.name) END);
    END LOOP;
    EXECUTE format('REVOKE ALL ON %I.%I FROM PUBLIC',r.nspname,r.relname);
    IF r.comment IS NOT NULL THEN EXECUTE format('COMMENT ON VIEW %I.%I IS %L',r.nspname,r.relname,r.comment); END IF;
  END LOOP;
  FOR r IN SELECT * FROM catalog_saved_grants LOOP
    EXECUTE format('GRANT %s ON %I.%I TO %s %s',r.privilege_type,r.nspname,r.relname,
      CASE WHEN r.grantee='PUBLIC' THEN 'PUBLIC' ELSE quote_ident(r.grantee) END,
      CASE WHEN r.is_grantable THEN 'WITH GRANT OPTION' ELSE '' END);
  END LOOP;
END $$;
COMMIT;
