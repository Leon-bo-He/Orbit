-- Link publications to a platform_account so the worker knows which credentials to use.
ALTER TABLE "publications"
  ADD COLUMN "platform_account_id" uuid
    REFERENCES "platform_accounts"("id") ON DELETE SET NULL;

CREATE INDEX "publications_platform_account_id_idx"
  ON "publications" ("platform_account_id");
