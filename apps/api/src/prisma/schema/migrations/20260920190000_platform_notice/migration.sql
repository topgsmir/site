CREATE TABLE "platform_notice" (
  "id" INTEGER NOT NULL PRIMARY KEY DEFAULT 1,
  "message" TEXT NOT NULL,
  "enabled" BOOLEAN NOT NULL DEFAULT false,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "platform_notice_singleton" CHECK ("id" = 1),
  CONSTRAINT "platform_notice_message_length" CHECK (char_length("message") <= 500),
  CONSTRAINT "platform_notice_enabled_message" CHECK (NOT "enabled" OR char_length(btrim("message")) > 0)
);
