-- Visitor analytics store (Cloudflare D1 / SQLite).
-- Apply with:
--   npx wrangler d1 execute site-analytics --remote --file=./schema.sql
-- (use --local instead of --remote to seed a local dev database)

CREATE TABLE IF NOT EXISTS pageviews (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  ts      INTEGER NOT NULL,   -- event time, unix milliseconds
  path    TEXT    NOT NULL,   -- pathname visited
  city    TEXT,               -- from Cloudflare request geo
  region  TEXT,
  country TEXT,
  vid     TEXT    NOT NULL    -- anonymous per-visitor id (cookie)
);

CREATE INDEX IF NOT EXISTS idx_pageviews_ts  ON pageviews(ts);
CREATE INDEX IF NOT EXISTS idx_pageviews_vid ON pageviews(vid);
