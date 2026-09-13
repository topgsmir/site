ALTER TYPE "payment_attempt_status" ADD VALUE IF NOT EXISTS 'initiating' AFTER 'created';
ALTER TYPE "payment_attempt_status" ADD VALUE IF NOT EXISTS 'initiation_unknown' AFTER 'initiating';
ALTER TYPE "payment_attempt_status" ADD VALUE IF NOT EXISTS 'refund_pending' AFTER 'succeeded';
ALTER TYPE "payment_attempt_status" ADD VALUE IF NOT EXISTS 'refund_unknown' AFTER 'refund_pending';
