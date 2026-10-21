-- Run during maintenance: rekeys orders and all dependent references atomically.
BEGIN;
SET LOCAL lock_timeout = '5s';
LOCK TABLE orders IN ACCESS EXCLUSIVE MODE;
CREATE TEMP TABLE order_id_map ON COMMIT DROP AS
  SELECT id AS old_id, order_number::text AS new_id FROM orders;
CREATE UNIQUE INDEX ON order_id_map(old_id);
CREATE UNIQUE INDEX ON order_id_map(new_id);

-- Several historical hand-written FKs omitted Prisma's default update cascade.
DO $$ DECLARE fk record; definition text; BEGIN
  FOR fk IN SELECT oid, conrelid::regclass AS relation, conname FROM pg_constraint
    WHERE contype = 'f' AND confrelid = 'orders'::regclass AND confupdtype <> 'c'
  LOOP
    definition := pg_get_constraintdef(fk.oid);
    definition := regexp_replace(definition, ' ON UPDATE (NO ACTION|RESTRICT|SET NULL|SET DEFAULT)', '');
    definition := replace(definition, ' ON DELETE', ' ON UPDATE CASCADE ON DELETE');
    IF position('ON UPDATE CASCADE' IN definition) = 0 THEN definition := definition || ' ON UPDATE CASCADE'; END IF;
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', fk.relation, fk.conname);
    EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I %s', fk.relation, fk.conname, definition);
  END LOOP;
END $$;

UPDATE orders o SET id = m.new_id FROM order_id_map m WHERE o.id = m.old_id;

-- Rebind durable event data so retries still resolve the same order.
CREATE FUNCTION pg_temp.remap_order_json(value jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE replacement text; result jsonb;
BEGIN
  CASE jsonb_typeof(value)
  WHEN 'string' THEN
    SELECT new_id INTO replacement FROM order_id_map WHERE old_id = value #>> '{}';
    RETURN COALESCE(to_jsonb(replacement), value);
  WHEN 'object' THEN
    SELECT COALESCE(jsonb_object_agg(key, pg_temp.remap_order_json(val)), '{}'::jsonb) INTO result FROM jsonb_each(value) AS entry(key,val);
    RETURN result;
  WHEN 'array' THEN
    SELECT COALESCE(jsonb_agg(pg_temp.remap_order_json(val) ORDER BY position), '[]'::jsonb) INTO result FROM jsonb_array_elements(value) WITH ORDINALITY AS entry(val,position);
    RETURN result;
  ELSE RETURN value;
  END CASE;
END $$;
UPDATE outbox_events e SET aggregate_id = m.new_id FROM order_id_map m WHERE e.aggregate = 'order' AND e.aggregate_id = m.old_id;
UPDATE outbox_events SET payload = pg_temp.remap_order_json(payload);
UPDATE outbox_events e SET dedupe_key = replace(e.dedupe_key, m.old_id, m.new_id) FROM order_id_map m WHERE position(m.old_id IN e.dedupe_key) > 0;

-- Identity-only journal repair: amounts and business history remain unchanged.
ALTER TABLE wallet_entries DISABLE TRIGGER wallet_entries_immutable;
ALTER TABLE club_point_entries DISABLE TRIGGER club_point_entries_immutable;
DO $$ DECLARE column_info record; BEGIN
  FOR column_info IN SELECT table_name,column_name FROM information_schema.columns
    WHERE table_schema = current_schema() AND column_name IN ('reference_id','operation_key','source_key')
      AND table_name IN ('wallet_entries','club_point_entries','club_point_lots','club_point_debt_events','club_wallet_credits','club_wallet_allocations')
  LOOP
    EXECUTE format('UPDATE %I t SET %I = replace(t.%I, m.old_id, m.new_id) FROM order_id_map m WHERE position(m.old_id IN t.%I) > 0', column_info.table_name, column_info.column_name, column_info.column_name, column_info.column_name);
  END LOOP;
END $$;
ALTER TABLE wallet_entries ENABLE TRIGGER wallet_entries_immutable;
ALTER TABLE club_point_entries ENABLE TRIGGER club_point_entries_immutable;

ALTER SEQUENCE orders_order_number_seq OWNED BY orders.id;
ALTER SEQUENCE orders_order_number_seq RENAME TO orders_id_seq;
ALTER TABLE orders ALTER COLUMN id SET DEFAULT (nextval('orders_id_seq'::regclass))::text;
ALTER TABLE orders DROP COLUMN order_number;
ALTER TABLE orders ADD CONSTRAINT orders_id_digits CHECK (id ~ '^[1-9][0-9]{0,18}$' AND id::numeric <= 9223372036854775807);
COMMIT;
