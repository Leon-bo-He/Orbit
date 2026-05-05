-- Create platform_accounts table.
-- Stores per-user social-platform credentials as encrypted Playwright storageState.
CREATE TABLE "platform_accounts" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "platform" text NOT NULL,
  "account_name" text NOT NULL,
  "display_name" text,
  "storage_state_enc" text NOT NULL,
  "cookie_status" text NOT NULL DEFAULT 'unknown',
  "cookie_checked_at" timestamptz,
  "last_used_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "platform_accounts_user_platform_account_uniq"
  ON "platform_accounts" ("user_id", "platform", "account_name");

CREATE INDEX "platform_accounts_user_platform_idx"
  ON "platform_accounts" ("user_id", "platform");
