-- A nullable pointer keeps existing users unchanged and makes picture replacement
-- a metadata-only update once the new image has been written.
ALTER TABLE "users" ADD COLUMN "profile_picture_key" UUID;
