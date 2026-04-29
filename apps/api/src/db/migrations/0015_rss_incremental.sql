DROP TABLE IF EXISTS "rss_cache";

CREATE TABLE "rss_feeds" (
  "url" text PRIMARY KEY NOT NULL,
  "last_fetched_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE "rss_articles" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "feed_url" text NOT NULL,
  "link" text NOT NULL,
  "title" text NOT NULL,
  "pub_date" text DEFAULT '' NOT NULL,
  "first_seen_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "rss_articles_feed_link_uniq" ON "rss_articles" ("feed_url", "link");
