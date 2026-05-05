-- Create upload_jobs table.
-- One row per attempted publish. Lifecycle: queued → running → succeeded|failed|canceled.
CREATE TABLE "upload_jobs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "publication_id" uuid NOT NULL REFERENCES "publications"("id") ON DELETE CASCADE,
  "platform_account_id" uuid REFERENCES "platform_accounts"("id") ON DELETE SET NULL,
  "status" text NOT NULL DEFAULT 'queued',
  "scheduled_at" timestamptz,
  "started_at" timestamptz,
  "finished_at" timestamptz,
  "attempt" integer NOT NULL DEFAULT 1,
  "bullmq_job_id" text,
  "runner_job_id" text,
  "result_url" text,
  "result_post_id" text,
  "failure_reason" text,
  "log_excerpt" text,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "upload_jobs_publication_id_idx" ON "upload_jobs" ("publication_id");
CREATE INDEX "upload_jobs_platform_account_id_idx" ON "upload_jobs" ("platform_account_id");
CREATE INDEX "upload_jobs_status_idx" ON "upload_jobs" ("status");
