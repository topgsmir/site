-- Nullable advisory notes for the physical product "know before ordering" panel.
-- Metadata-only ADD COLUMN: no table rewrite.
ALTER TABLE "products" ADD COLUMN "shipping_note" VARCHAR(2000);
ALTER TABLE "products" ADD COLUMN "compatibility_note" VARCHAR(2000);
