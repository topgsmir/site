-- Ordered sections for each expert's public page.
-- A constant jsonb default is metadata-only on PostgreSQL 11+.
ALTER TABLE "sellers" ADD COLUMN "page_blocks" JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE "sellers" ADD CONSTRAINT "sellers_page_blocks_array"
  CHECK (jsonb_typeof("page_blocks") = 'array' AND jsonb_array_length("page_blocks") <= 12);
