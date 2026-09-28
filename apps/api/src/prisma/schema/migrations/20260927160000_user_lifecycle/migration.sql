SET lock_timeout = '5s';
ALTER TABLE users ADD COLUMN account_status TEXT NOT NULL DEFAULT 'active',
 ADD COLUMN blocked_at TIMESTAMPTZ, ADD COLUMN deletion_requested_at TIMESTAMPTZ, ADD COLUMN deleted_at TIMESTAMPTZ,
 ADD CONSTRAINT users_account_status_check CHECK (account_status IN ('active','blocked','deletion_pending','deleted')),
 ADD CONSTRAINT users_deleted_identity_check CHECK (account_status <> 'deleted' OR (deleted_at IS NOT NULL AND email IS NULL AND username IS NULL AND phone_number IS NULL AND password_hash IS NULL));
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_contact_required_check, DROP CONSTRAINT IF EXISTS users_staff_email_required_check,
 ADD CONSTRAINT users_contact_required_check CHECK (account_status='deleted' OR email IS NOT NULL OR phone_number IS NOT NULL),
 ADD CONSTRAINT users_staff_email_required_check CHECK (account_status='deleted' OR role='buyer' OR email IS NOT NULL);
ALTER TABLE sellers ADD COLUMN merged_into_seller_id TEXT, ADD COLUMN merged_at TIMESTAMPTZ,
 ADD CONSTRAINT seller_merge_check CHECK (merged_into_seller_id IS NULL OR (merged_into_seller_id <> id AND merged_at IS NOT NULL AND suspended_at IS NOT NULL)),
 ADD CONSTRAINT sellers_merged_into_seller_id_fkey FOREIGN KEY (merged_into_seller_id) REFERENCES sellers(id) ON DELETE RESTRICT;
CREATE TABLE user_account_events (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 actor_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT, action TEXT NOT NULL,
 reason TEXT NOT NULL CHECK (length(reason) BETWEEN 3 AND 500), before_data JSONB NOT NULL DEFAULT '{}',
 after_data JSONB NOT NULL DEFAULT '{}', created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX ON user_account_events(user_id, created_at DESC, id DESC);
CREATE INDEX ON user_account_events(actor_user_id);
CREATE TABLE user_deletion_jobs (
 id UUID PRIMARY KEY DEFAULT gen_random_uuid(), user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 actor_user_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 replacement_user_id TEXT REFERENCES users(id) ON DELETE RESTRICT,
 source_seller_id TEXT, destination_seller_id TEXT,
 mode TEXT NOT NULL CHECK (mode IN ('content','handoff','merge')),
 status TEXT NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','failed','completed')),
 phase INTEGER NOT NULL DEFAULT 0 CHECK (phase >= 0), cursor TEXT,
 expected JSONB NOT NULL DEFAULT '{}', progress JSONB NOT NULL DEFAULT '{}', conflict_report JSONB NOT NULL DEFAULT '{}', seller_previous JSONB NOT NULL DEFAULT '{}',
 reason TEXT NOT NULL CHECK (length(reason) BETWEEN 3 AND 500), attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
 error_code TEXT, next_attempt_at TIMESTAMPTZ NOT NULL DEFAULT now(),
 created_at TIMESTAMPTZ NOT NULL DEFAULT now(), updated_at TIMESTAMPTZ NOT NULL DEFAULT now(), completed_at TIMESTAMPTZ,
 CHECK (user_id <> replacement_user_id), CHECK (user_id <> actor_user_id)
);
CREATE UNIQUE INDEX user_deletion_jobs_active_subject ON user_deletion_jobs(user_id) WHERE status <> 'completed';
CREATE INDEX ON user_deletion_jobs(status, next_attempt_at, created_at);
CREATE INDEX ON user_deletion_jobs(user_id, created_at DESC);
CREATE INDEX ON user_deletion_jobs(replacement_user_id);
CREATE INDEX ON user_deletion_jobs(actor_user_id);
CREATE TABLE user_lifecycle_locks (
 entity_type TEXT NOT NULL CHECK (entity_type IN ('user','seller')), entity_id TEXT NOT NULL,
 job_id UUID NOT NULL REFERENCES user_deletion_jobs(id) ON DELETE RESTRICT,
 PRIMARY KEY(entity_type, entity_id)
);
CREATE INDEX ON user_lifecycle_locks(job_id);

-- Every participating write takes a shared advisory lock. Enqueue takes the
-- exclusive counterpart before its snapshot, so in-flight writes must finish.
-- Durable lock rows fence subsequent writes even across worker restarts.
CREATE FUNCTION lifecycle_check(kind TEXT, identity TEXT) RETURNS VOID LANGUAGE plpgsql AS $$
DECLARE held UUID;
BEGIN
 IF identity IS NULL THEN RETURN; END IF;
 PERFORM pg_advisory_xact_lock_shared(hashtextextended('lifecycle:' || kind || ':' || identity, 0));
 SELECT job_id INTO held FROM user_lifecycle_locks WHERE entity_type=kind AND entity_id=identity;
 IF held IS NOT NULL AND held::text IS DISTINCT FROM current_setting('topgsm.lifecycle_job', true) THEN
   RAISE EXCEPTION 'Account transfer in progress' USING ERRCODE='55000';
 END IF;
END $$;
CREATE FUNCTION lifecycle_fence() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v JSONB; old_v JSONB; i INTEGER;
BEGIN
 v := CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
 old_v := CASE WHEN TG_OP='UPDATE' THEN to_jsonb(OLD) ELSE v END;
 FOR i IN 0..TG_NARGS-1 BY 2 LOOP
   PERFORM lifecycle_check(TG_ARGV[i], old_v->>TG_ARGV[i+1]);
   IF v->>TG_ARGV[i+1] IS DISTINCT FROM old_v->>TG_ARGV[i+1] THEN
     PERFORM lifecycle_check(TG_ARGV[i], v->>TG_ARGV[i+1]);
   END IF;
 END LOOP;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER lifecycle_users BEFORE UPDATE OR DELETE ON users FOR EACH ROW EXECUTE FUNCTION lifecycle_fence('user','id');
CREATE TRIGGER lifecycle_sellers BEFORE INSERT OR UPDATE OR DELETE ON sellers FOR EACH ROW EXECUTE FUNCTION lifecycle_fence('seller','id','user','user_id');
CREATE TRIGGER lifecycle_memberships BEFORE INSERT OR UPDATE OR DELETE ON seller_memberships FOR EACH ROW EXECUTE FUNCTION lifecycle_fence('user','user_id','seller','seller_id');
CREATE TRIGGER lifecycle_permissions BEFORE INSERT OR UPDATE OR DELETE ON platform_staff_permissions FOR EACH ROW EXECUTE FUNCTION lifecycle_fence('user','user_id');
CREATE TRIGGER lifecycle_products BEFORE INSERT OR UPDATE OR DELETE ON products FOR EACH ROW EXECUTE FUNCTION lifecycle_fence('seller','created_by_seller_id');
CREATE TRIGGER lifecycle_listings BEFORE INSERT OR UPDATE OR DELETE ON seller_listings FOR EACH ROW EXECUTE FUNCTION lifecycle_fence('seller','seller_id');
CREATE TRIGGER lifecycle_coupons BEFORE INSERT OR UPDATE OR DELETE ON coupons FOR EACH ROW EXECUTE FUNCTION lifecycle_fence('seller','seller_id');
CREATE TRIGGER lifecycle_posts BEFORE INSERT OR UPDATE OR DELETE ON blog_posts FOR EACH ROW EXECUTE FUNCTION lifecycle_fence('user','creator_user_id','seller','seller_id');
CREATE TRIGGER lifecycle_blog_media BEFORE INSERT OR UPDATE OR DELETE ON blog_media_assets FOR EACH ROW EXECUTE FUNCTION lifecycle_fence('user','owner_user_id','seller','seller_id');
CREATE TRIGGER lifecycle_product_media BEFORE INSERT OR UPDATE OR DELETE ON product_media_assets FOR EACH ROW EXECUTE FUNCTION lifecycle_fence('user','uploaded_by_user_id');
CREATE TRIGGER lifecycle_comments BEFORE INSERT OR UPDATE OR DELETE ON comments FOR EACH ROW EXECUTE FUNCTION lifecycle_fence('user','author_user_id');
CREATE TRIGGER lifecycle_assignments BEFORE INSERT OR UPDATE OR DELETE ON comment_assignments FOR EACH ROW EXECUTE FUNCTION lifecycle_fence('seller','seller_id');
CREATE TRIGGER lifecycle_orders BEFORE INSERT OR UPDATE OR DELETE ON orders FOR EACH ROW EXECUTE FUNCTION lifecycle_fence('user','buyer_id','seller','seller_id');
CREATE TRIGGER lifecycle_checkouts BEFORE INSERT OR UPDATE OR DELETE ON checkouts FOR EACH ROW EXECUTE FUNCTION lifecycle_fence('user','buyer_id');
CREATE TRIGGER lifecycle_payouts BEFORE INSERT OR UPDATE OR DELETE ON payout_ledger FOR EACH ROW EXECUTE FUNCTION lifecycle_fence('seller','seller_id');
CREATE TRIGGER lifecycle_connections BEFORE INSERT OR UPDATE OR DELETE ON bridge_connections FOR EACH ROW EXECUTE FUNCTION lifecycle_fence('seller','seller_id');
CREATE TRIGGER lifecycle_grants BEFORE INSERT OR UPDATE OR DELETE ON bridge_service_grants FOR EACH ROW EXECUTE FUNCTION lifecycle_fence('seller','seller_id');
CREATE TRIGGER lifecycle_shipping BEFORE INSERT OR UPDATE OR DELETE ON seller_shipping_profiles FOR EACH ROW EXECUTE FUNCTION lifecycle_fence('seller','seller_id');
CREATE TRIGGER lifecycle_seller_permissions BEFORE INSERT OR UPDATE OR DELETE ON seller_permissions FOR EACH ROW EXECUTE FUNCTION lifecycle_fence('seller','seller_id');
CREATE TRIGGER lifecycle_ai BEFORE INSERT OR UPDATE OR DELETE ON ai_conversations FOR EACH ROW EXECUTE FUNCTION lifecycle_fence('user','owner_user_id');
CREATE FUNCTION lifecycle_session_check() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE state TEXT;
BEGIN
 PERFORM lifecycle_check('user', NEW.user_id);
 SELECT account_status INTO state FROM users WHERE id=NEW.user_id FOR SHARE;
 IF state IS DISTINCT FROM 'active' THEN RAISE EXCEPTION 'Account unavailable' USING ERRCODE='55000'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER lifecycle_session BEFORE INSERT ON auth_sessions FOR EACH ROW EXECUTE FUNCTION lifecycle_session_check();
-- Never allow an existing writer (profile/vendor/staff) to resurrect a tombstone.
CREATE FUNCTION lifecycle_terminal_user() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.account_status='deleted' AND NEW IS DISTINCT FROM OLD THEN
   RAISE EXCEPTION 'Account deleted' USING ERRCODE='55000';
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER lifecycle_terminal BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION lifecycle_terminal_user();

-- Operational ownership may never be reassigned back to a tombstone or an
-- archived seller. Provenance fields (uploader, replier, actor) are excluded.
CREATE FUNCTION lifecycle_live_owner() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v JSONB := to_jsonb(NEW); i INTEGER; identity TEXT;
BEGIN
 FOR i IN 0..TG_NARGS-1 BY 2 LOOP
   identity := v->>TG_ARGV[i+1];
   IF (TG_ARGV[i]='user' AND EXISTS(SELECT 1 FROM users WHERE id=identity AND account_status='deleted')) OR
      (TG_ARGV[i]='seller' AND EXISTS(SELECT 1 FROM sellers WHERE id=identity AND merged_into_seller_id IS NOT NULL)) THEN
     RAISE EXCEPTION 'Owner is archived' USING ERRCODE='55000';
   END IF;
 END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER lifecycle_live_product BEFORE INSERT OR UPDATE ON products FOR EACH ROW EXECUTE FUNCTION lifecycle_live_owner('seller','created_by_seller_id');
CREATE TRIGGER lifecycle_live_listing BEFORE INSERT OR UPDATE ON seller_listings FOR EACH ROW EXECUTE FUNCTION lifecycle_live_owner('seller','seller_id');
CREATE TRIGGER lifecycle_live_coupon BEFORE INSERT OR UPDATE ON coupons FOR EACH ROW EXECUTE FUNCTION lifecycle_live_owner('seller','seller_id');
CREATE TRIGGER lifecycle_live_post BEFORE INSERT OR UPDATE ON blog_posts FOR EACH ROW EXECUTE FUNCTION lifecycle_live_owner('user','creator_user_id','seller','seller_id');
CREATE TRIGGER lifecycle_live_media BEFORE INSERT OR UPDATE ON blog_media_assets FOR EACH ROW EXECUTE FUNCTION lifecycle_live_owner('user','owner_user_id','seller','seller_id');
CREATE TRIGGER lifecycle_live_comment BEFORE INSERT OR UPDATE ON comments FOR EACH ROW EXECUTE FUNCTION lifecycle_live_owner('user','author_user_id');
CREATE TRIGGER lifecycle_live_membership BEFORE INSERT OR UPDATE ON seller_memberships FOR EACH ROW EXECUTE FUNCTION lifecycle_live_owner('user','user_id','seller','seller_id');
CREATE TRIGGER lifecycle_live_permissions BEFORE INSERT OR UPDATE ON platform_staff_permissions FOR EACH ROW EXECUTE FUNCTION lifecycle_live_owner('user','user_id');
CREATE TRIGGER lifecycle_live_seller_owner BEFORE INSERT OR UPDATE OF user_id ON sellers FOR EACH ROW EXECUTE FUNCTION lifecycle_live_owner('user','user_id');
CREATE TRIGGER lifecycle_live_order BEFORE INSERT OR UPDATE OF buyer_id, seller_id ON orders FOR EACH ROW EXECUTE FUNCTION lifecycle_live_owner('user','buyer_id','seller','seller_id');
CREATE TRIGGER lifecycle_live_checkout BEFORE INSERT OR UPDATE OF buyer_id ON checkouts FOR EACH ROW EXECUTE FUNCTION lifecycle_live_owner('user','buyer_id');
CREATE TRIGGER lifecycle_live_ai BEFORE INSERT OR UPDATE OF owner_user_id ON ai_conversations FOR EACH ROW EXECUTE FUNCTION lifecycle_live_owner('user','owner_user_id');
CREATE FUNCTION lifecycle_terminal_seller() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.merged_into_seller_id IS NOT NULL AND (TG_OP='DELETE' OR NEW IS DISTINCT FROM OLD) THEN RAISE EXCEPTION 'Seller is archived' USING ERRCODE='55000'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER lifecycle_terminal BEFORE UPDATE OR DELETE ON sellers FOR EACH ROW EXECUTE FUNCTION lifecycle_terminal_seller();

-- Child money records must participate in the enqueue fence, not just orders.
CREATE FUNCTION lifecycle_commercial_fence() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v JSONB; order_identity TEXT; buyer TEXT; seller TEXT;
BEGIN
 v := CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
 IF TG_TABLE_NAME='payment_refunds' THEN SELECT order_id INTO order_identity FROM payment_attempts WHERE id=v->>'payment_attempt_id';
 ELSIF TG_TABLE_NAME='bridge_fulfillments' THEN SELECT order_id INTO order_identity FROM order_items WHERE id=v->>'order_item_id';
 ELSE order_identity := v->>'order_id'; END IF;
 SELECT buyer_id, seller_id INTO buyer, seller FROM orders WHERE id=order_identity;
 PERFORM lifecycle_check('user', buyer); PERFORM lifecycle_check('seller', seller);
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER lifecycle_payment BEFORE INSERT OR UPDATE OR DELETE ON payment_attempts FOR EACH ROW EXECUTE FUNCTION lifecycle_commercial_fence();
CREATE TRIGGER lifecycle_refund BEFORE INSERT OR UPDATE OR DELETE ON payment_refunds FOR EACH ROW EXECUTE FUNCTION lifecycle_commercial_fence();
CREATE TRIGGER lifecycle_fulfillment BEFORE INSERT OR UPDATE OR DELETE ON bridge_fulfillments FOR EACH ROW EXECUTE FUNCTION lifecycle_commercial_fence();
CREATE TRIGGER lifecycle_dispatch BEFORE INSERT OR UPDATE OR DELETE ON amadast_shipments FOR EACH ROW EXECUTE FUNCTION lifecycle_commercial_fence();
CREATE TRIGGER lifecycle_profile_history BEFORE INSERT OR UPDATE OR DELETE ON admin_user_profile_changes FOR EACH ROW EXECUTE FUNCTION lifecycle_fence('user','user_id');
CREATE TRIGGER lifecycle_ai_run BEFORE INSERT OR UPDATE OR DELETE ON ai_runs FOR EACH ROW EXECUTE FUNCTION lifecycle_fence('user','requester_id');
CREATE FUNCTION lifecycle_phone_fence() RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE v JSONB; identity TEXT;
BEGIN
 v := CASE WHEN TG_OP='DELETE' THEN to_jsonb(OLD) ELSE to_jsonb(NEW) END;
 SELECT id INTO identity FROM users WHERE phone_number=v->>TG_ARGV[0];
 PERFORM lifecycle_check('user', identity);
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
CREATE TRIGGER lifecycle_otp BEFORE INSERT OR UPDATE OR DELETE ON otp_challenges FOR EACH ROW EXECUTE FUNCTION lifecycle_phone_fence('phone_number');
CREATE TRIGGER lifecycle_sms BEFORE INSERT OR UPDATE OR DELETE ON sms_deliveries FOR EACH ROW EXECUTE FUNCTION lifecycle_phone_fence('recipient');

-- Listings are operational ownership; order/payout seller IDs are immutable.
-- The only reparenting exception is the exact, fenced lifecycle worker job.
-- Separate trigger-table branches before accessing table-specific NEW fields.
CREATE OR REPLACE FUNCTION prevent_offer_seller_reparenting() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
 IF TG_TABLE_NAME='seller_offers' THEN
   IF NEW.listing_id IS DISTINCT FROM OLD.listing_id AND EXISTS (
     SELECT 1 FROM order_items i JOIN orders o ON o.id=i.order_id
     JOIN seller_listings l ON l.id=NEW.listing_id WHERE i.offer_id=OLD.id AND o.seller_id<>l.seller_id
   ) THEN RAISE EXCEPTION 'Cannot move an offer across historical sellers'; END IF;
 ELSIF TG_TABLE_NAME='seller_listings' THEN
   IF NEW.seller_id IS DISTINCT FROM OLD.seller_id AND EXISTS (
     SELECT 1 FROM seller_offers f JOIN order_items i ON i.offer_id=f.id
     JOIN orders o ON o.id=i.order_id WHERE f.listing_id=OLD.id AND o.seller_id<>NEW.seller_id
   ) AND NOT EXISTS (
     SELECT 1 FROM user_deletion_jobs j
     JOIN user_lifecycle_locks s ON s.job_id=j.id AND s.entity_type='seller' AND s.entity_id=OLD.seller_id
     JOIN user_lifecycle_locks d ON d.job_id=j.id AND d.entity_type='seller' AND d.entity_id=NEW.seller_id
     WHERE j.id::text=current_setting('topgsm.lifecycle_job',true) AND j.mode='merge'
     AND j.status IN ('queued','running') AND j.source_seller_id=OLD.seller_id AND j.destination_seller_id=NEW.seller_id
   ) THEN RAISE EXCEPTION 'Cannot move a listing across historical sellers'; END IF;
 END IF;
 RETURN NEW;
END $$;
RESET lock_timeout;
