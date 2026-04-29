CREATE TABLE "ai_configs" (
  "user_id" uuid PRIMARY KEY NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "base_url" text NOT NULL,
  "api_key" text NOT NULL,
  "model" text NOT NULL DEFAULT 'gpt-4o-mini',
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "rss_reports" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "feed_url" text NOT NULL,
  "report_type" text NOT NULL,
  "content" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "rss_reports_lookup_idx" ON "rss_reports" ("user_id", "feed_url", "report_type", "created_at");
