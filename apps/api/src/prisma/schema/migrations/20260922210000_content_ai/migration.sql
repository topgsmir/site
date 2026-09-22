-- Opt-in grants: existing sellers receive neither permission automatically.
ALTER TYPE "seller_permission" ADD VALUE IF NOT EXISTS 'blog_ai';
ALTER TYPE "seller_permission" ADD VALUE IF NOT EXISTS 'products_ai';

INSERT INTO "ai_capabilities" ("key") VALUES ('blog_authoring'), ('product_authoring')
ON CONFLICT ("key") DO NOTHING;
