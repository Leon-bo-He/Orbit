CREATE TABLE "rss_cache" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "url" text NOT NULL,
  "hash" text NOT NULL,
  "articles" jsonb NOT NULL,
  "fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "rss_cache_url_unique" UNIQUE("url")
);
