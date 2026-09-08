-- PostgreSQL requires a newly added enum value to be committed before it can
-- be referenced by data-changing statements. The following Bridge migration
-- performs a products_publish backfill, so introduce the value separately.
ALTER TYPE "seller_permission" ADD VALUE IF NOT EXISTS 'products_publish' AFTER 'products_manage';
