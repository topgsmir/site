ALTER TABLE "users" ALTER COLUMN "email" DROP NOT NULL;

ALTER TABLE "users" ADD CONSTRAINT "users_contact_required_check"
  CHECK ("email" IS NOT NULL OR "phone_number" IS NOT NULL);

ALTER TABLE "users" ADD CONSTRAINT "users_staff_email_required_check"
  CHECK ("role" = 'buyer' OR "email" IS NOT NULL);
