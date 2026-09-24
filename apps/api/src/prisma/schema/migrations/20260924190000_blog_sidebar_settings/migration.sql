CREATE TABLE "blog_sidebar_settings" (
  "locale" "blog_locale" NOT NULL PRIMARY KEY,
  "enabled" BOOLEAN NOT NULL DEFAULT true,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "cta_label" TEXT NOT NULL,
  "cta_href" TEXT NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "updated_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_by_id" TEXT NOT NULL,
  CONSTRAINT "blog_sidebar_settings_title_check" CHECK (length("title") BETWEEN 1 AND 120),
  CONSTRAINT "blog_sidebar_settings_description_check" CHECK (length("description") <= 500),
  CONSTRAINT "blog_sidebar_settings_cta_label_check" CHECK (length("cta_label") BETWEEN 1 AND 60),
  CONSTRAINT "blog_sidebar_settings_cta_href_check" CHECK (length("cta_href") BETWEEN 1 AND 2048),
  CONSTRAINT "blog_sidebar_settings_version_check" CHECK ("version" > 0),
  CONSTRAINT "blog_sidebar_settings_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "blog_sidebar_settings_updated_by_id_idx" ON "blog_sidebar_settings"("updated_by_id");

CREATE TABLE "blog_sidebar_products" (
  "locale" "blog_locale" NOT NULL,
  "product_id" UUID NOT NULL,
  "position" INTEGER NOT NULL,
  CONSTRAINT "blog_sidebar_products_pkey" PRIMARY KEY ("locale", "product_id"),
  CONSTRAINT "blog_sidebar_products_locale_position_key" UNIQUE ("locale", "position"),
  CONSTRAINT "blog_sidebar_products_position_check" CHECK ("position" BETWEEN 0 AND 2),
  CONSTRAINT "blog_sidebar_products_locale_fkey" FOREIGN KEY ("locale") REFERENCES "blog_sidebar_settings"("locale") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "blog_sidebar_products_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "blog_sidebar_products_product_id_idx" ON "blog_sidebar_products"("product_id");
