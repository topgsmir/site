CREATE TABLE "payment_method_configs" (
  "provider_code" VARCHAR(32) NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "payment_method_configs_pkey" PRIMARY KEY ("provider_code")
);

CREATE TABLE "payment_method_seller_rules" (
  "provider_code" VARCHAR(32) NOT NULL,
  "seller_id" TEXT NOT NULL,
  CONSTRAINT "payment_method_seller_rules_pkey" PRIMARY KEY ("provider_code", "seller_id"),
  CONSTRAINT "payment_method_seller_rules_provider_code_fkey"
    FOREIGN KEY ("provider_code") REFERENCES "payment_method_configs"("provider_code")
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "payment_method_seller_rules_seller_id_fkey"
    FOREIGN KEY ("seller_id") REFERENCES "sellers"("id")
    ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "payment_method_seller_rules_seller_id_idx"
ON "payment_method_seller_rules" ("seller_id");

CREATE TABLE "payment_method_product_type_rules" (
  "provider_code" VARCHAR(32) NOT NULL,
  "product_type" "product_type" NOT NULL,
  CONSTRAINT "payment_method_product_type_rules_pkey" PRIMARY KEY ("provider_code", "product_type"),
  CONSTRAINT "payment_method_product_type_rules_provider_code_fkey"
    FOREIGN KEY ("provider_code") REFERENCES "payment_method_configs"("provider_code")
    ON DELETE CASCADE ON UPDATE CASCADE
);

INSERT INTO "payment_method_configs" ("provider_code", "enabled")
VALUES ('zarinpal', true), ('local-country-gateway', false);
