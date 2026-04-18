-- Create notification_channels table
CREATE TABLE "notification_channels" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "type" text NOT NULL,
  "enabled" boolean NOT NULL DEFAULT true,
  "config" jsonb NOT NULL DEFAULT '{}',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "notification_channels_user_type_uniq"
  ON "notification_channels" ("user_id", "type");

-- Migrate existing telegram data from users into notification_channels
INSERT INTO "notification_channels" ("id", "user_id", "type", "enabled", "config", "created_at", "updated_at")
SELECT
  gen_random_uuid(),
  "id",
  'telegram',
  "telegram_notifications_enabled",
  jsonb_build_object('botToken', "telegram_bot_token", 'chatId', "telegram_chat_id"),
  now(),
  now()
FROM "users"
WHERE "telegram_bot_token" IS NOT NULL OR "telegram_chat_id" IS NOT NULL;

-- Drop telegram columns from users (now owned by notification_channels)
ALTER TABLE "users" DROP COLUMN "telegram_bot_token";
ALTER TABLE "users" DROP COLUMN "telegram_chat_id";
ALTER TABLE "users" DROP COLUMN "telegram_notifications_enabled";
