SET lock_timeout = '5s';
SET statement_timeout = '30s';

ALTER TABLE "seller_offer_service"
  ADD COLUMN "input_schema" JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE "order_items"
  ADD COLUMN "service_input_schema" JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN "encrypted_service_answers" TEXT,
  ADD COLUMN "service_answers_key_id" VARCHAR(32);

ALTER TABLE "seller_offer_service"
  ADD CONSTRAINT "seller_offer_service_input_schema_array_check"
  CHECK (jsonb_typeof("input_schema") = 'array');

ALTER TABLE "order_items"
  ADD CONSTRAINT "order_items_service_input_schema_array_check"
  CHECK (jsonb_typeof("service_input_schema") = 'array'),
  ADD CONSTRAINT "order_items_service_answers_envelope_check"
  CHECK (
    ("encrypted_service_answers" IS NULL AND "service_answers_key_id" IS NULL)
    OR
    ("encrypted_service_answers" IS NOT NULL AND "service_answers_key_id" IS NOT NULL AND "product_type" = 'service')
  );
