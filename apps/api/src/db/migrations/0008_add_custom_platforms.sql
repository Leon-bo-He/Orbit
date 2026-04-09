CREATE TABLE IF NOT EXISTS custom_platforms (
  id         text        PRIMARY KEY,
  user_id    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name       text        NOT NULL,
  icon       text        NOT NULL DEFAULT '📌',
  created_at timestamptz NOT NULL DEFAULT now()
);
