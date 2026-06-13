-- Visitor analytics store (Cloudflare D1 / SQLite).
-- Apply with:
--   npx wrangler d1 execute site-analytics --remote --file=./schema.sql
-- (use --local instead of --remote to seed a local dev database)
--
-- If the table already exists from an earlier schema (without lat/lng),
-- run migrations.sql instead to add the new columns without losing data.

CREATE TABLE IF NOT EXISTS pageviews (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  ts      INTEGER NOT NULL,   -- event time, unix milliseconds
  path    TEXT    NOT NULL,   -- pathname visited
  city    TEXT,               -- from Cloudflare request geo
  region  TEXT,               -- state / province
  country TEXT,               -- ISO-2 country code
  lat     REAL,               -- approximate latitude  (Cloudflare geo)
  lng     REAL,               -- approximate longitude (Cloudflare geo)
  vid     TEXT    NOT NULL    -- anonymous per-visitor id (cookie)
);

CREATE INDEX IF NOT EXISTS idx_pageviews_ts  ON pageviews(ts);
CREATE INDEX IF NOT EXISTS idx_pageviews_vid ON pageviews(vid);
