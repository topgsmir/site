ALTER TABLE "payout_ledger" ADD COLUMN "marketing_commission_amount" DECIMAL(20,4) NOT NULL DEFAULT 0;
ALTER TABLE "payout_ledger" ADD COLUMN "platform_marketing_commission_amount" DECIMAL(20,4) NOT NULL DEFAULT 0;

CREATE TABLE "marketing_links" (
  "id" UUID NOT NULL,
  "code" VARCHAR(32) NOT NULL,
  "seller_id" TEXT NOT NULL,
  "product_id" UUID NOT NULL,
  "created_by_user_id" TEXT NOT NULL,
  "recipient_name" VARCHAR(120) NOT NULL,
  "recipient_contact" VARCHAR(160),
  "commission_rate" DECIMAL(7,6) NOT NULL,
  "funding_source" VARCHAR(16) NOT NULL DEFAULT 'seller',
  "active" BOOLEAN NOT NULL DEFAULT true,
  "expires_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "marketing_links_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "marketing_links_rate_check" CHECK ("commission_rate" > 0 AND "commission_rate" <= 0.3),
  CONSTRAINT "marketing_links_funding_check" CHECK ("funding_source" IN ('seller', 'platform'))
);

CREATE UNIQUE INDEX "marketing_links_code_key" ON "marketing_links"("code");
CREATE INDEX "marketing_links_seller_id_created_at_id_idx" ON "marketing_links"("seller_id", "created_at" DESC, "id" DESC);
CREATE INDEX "marketing_links_product_id_active_idx" ON "marketing_links"("product_id", "active");
ALTER TABLE "marketing_links" ADD CONSTRAINT "marketing_links_seller_id_fkey" FOREIGN KEY ("seller_id") REFERENCES "sellers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "marketing_links" ADD CONSTRAINT "marketing_links_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "marketing_links" ADD CONSTRAINT "marketing_links_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "marketing_visits" (
  "id" UUID NOT NULL,
  "link_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "marketing_visits_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "marketing_visits_link_id_created_at_id_idx" ON "marketing_visits"("link_id", "created_at" DESC, "id" DESC);
ALTER TABLE "marketing_visits" ADD CONSTRAINT "marketing_visits_link_id_fkey" FOREIGN KEY ("link_id") REFERENCES "marketing_links"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "marketing_earnings" (
  "id" UUID NOT NULL,
  "link_id" UUID NOT NULL,
  "visit_id" UUID NOT NULL,
  "order_id" TEXT NOT NULL,
  "order_item_id" TEXT NOT NULL,
  "base_amount" DECIMAL(20,4) NOT NULL,
  "commission_rate" DECIMAL(7,6) NOT NULL,
  "amount" DECIMAL(20,4) NOT NULL,
  "funding_source" VARCHAR(16) NOT NULL,
  "status" VARCHAR(24) NOT NULL DEFAULT 'pending',
  "paid_at" TIMESTAMPTZ(3),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "marketing_earnings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "marketing_earnings_amount_check" CHECK ("base_amount" >= 0 AND "amount" > 0 AND "commission_rate" > 0 AND "commission_rate" <= 0.3),
  CONSTRAINT "marketing_earnings_funding_check" CHECK ("funding_source" IN ('seller', 'platform')),
  CONSTRAINT "marketing_earnings_status_check" CHECK ("status" IN ('pending', 'payable', 'paid', 'reversed'))
);
CREATE UNIQUE INDEX "marketing_earnings_order_item_id_key" ON "marketing_earnings"("order_item_id");
CREATE INDEX "marketing_earnings_link_id_created_at_id_idx" ON "marketing_earnings"("link_id", "created_at" DESC, "id" DESC);
CREATE INDEX "marketing_earnings_order_id_idx" ON "marketing_earnings"("order_id");
CREATE INDEX "marketing_earnings_status_created_at_id_idx" ON "marketing_earnings"("status", "created_at" DESC, "id" DESC);
ALTER TABLE "marketing_earnings" ADD CONSTRAINT "marketing_earnings_link_id_fkey" FOREIGN KEY ("link_id") REFERENCES "marketing_links"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "marketing_earnings" ADD CONSTRAINT "marketing_earnings_visit_id_fkey" FOREIGN KEY ("visit_id") REFERENCES "marketing_visits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "marketing_earnings" ADD CONSTRAINT "marketing_earnings_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "marketing_earnings" ADD CONSTRAINT "marketing_earnings_order_item_id_fkey" FOREIGN KEY ("order_item_id") REFERENCES "order_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "marketing_events" (
  "id" UUID NOT NULL,
  "link_id" UUID NOT NULL,
  "actor_user_id" TEXT NOT NULL,
  "action" VARCHAR(32) NOT NULL,
  "detail" VARCHAR(200),
  "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "marketing_events_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "marketing_events_link_id_created_at_id_idx" ON "marketing_events"("link_id", "created_at" DESC, "id" DESC);
ALTER TABLE "marketing_events" ADD CONSTRAINT "marketing_events_link_id_fkey" FOREIGN KEY ("link_id") REFERENCES "marketing_links"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "marketing_events" ADD CONSTRAINT "marketing_events_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Give public visits their own atomic bucket so referral traffic cannot exhaust checkout quote limits.
ALTER TABLE "auth_rate_limits" ADD CONSTRAINT "auth_rate_limits_action_marketing_check" CHECK (
  "action" IN ('login','register','order','shipping','shipping_configuration','payout','media','media_admin','otp','payment','payment_callback','payment_refund','payment_configuration','sms_configuration','staff_setup','bridge','signed_ticket','ai_profile','ai_profile_test','ai_run','product_bulk_undo','checkout_quote','marketing_visit','analytics','auth_configuration','captcha_challenge','comment_submit','comment_reply','comment_admin','profile','goghdi_configuration','backup_admin','backup_restore','admin_user','blog','coupon','digital_download','notice_configuration','seo_configuration','product','seller','staff_admin','usd_configuration')
) NOT VALID;
ALTER TABLE "auth_rate_limits" VALIDATE CONSTRAINT "auth_rate_limits_action_marketing_check";
ALTER TABLE "auth_rate_limits" DROP CONSTRAINT "auth_rate_limits_action_check";
ALTER TABLE "auth_rate_limits" RENAME CONSTRAINT "auth_rate_limits_action_marketing_check" TO "auth_rate_limits_action_check";

ALTER TABLE "security_policies" ADD CONSTRAINT "security_policies_action_marketing_check" CHECK (
  "action" IN ('login','register','otp','profile','admin_user','captcha_challenge','checkout_quote','marketing_visit','comment_submit_guest','comment_submit','comment_reply','comment_admin','blog','coupon','product','order','digital_download','shipping','shipping_configuration','payout','media','media_admin','payment','payment_callback','payment_refund','payment_configuration','sms_configuration','goghdi_configuration','auth_configuration','notice_configuration','seo_configuration','usd_configuration','staff_admin','staff_setup','seller','bridge','signed_ticket','ai_profile','ai_profile_test','ai_run','product_bulk_undo','analytics','backup_admin','backup_restore')
) NOT VALID;
ALTER TABLE "security_policies" VALIDATE CONSTRAINT "security_policies_action_marketing_check";
ALTER TABLE "security_policies" DROP CONSTRAINT "security_policies_action_check";
ALTER TABLE "security_policies" RENAME CONSTRAINT "security_policies_action_marketing_check" TO "security_policies_action_check";
