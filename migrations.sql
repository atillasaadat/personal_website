-- Migration: add approximate lat/lng to an existing pageviews table.
-- Apply once to a database created with the original schema:
--   npx wrangler d1 execute site-analytics --remote --file=./migrations.sql
--
-- SQLite ignores errors here only if run column-by-column; if a column already
-- exists the statement errors harmlessly and the other can be run on its own.
ALTER TABLE pageviews ADD COLUMN lat REAL;
ALTER TABLE pageviews ADD COLUMN lng REAL;

-- Migration: add network org/ASN and external referrer. Run each line; an
-- ALTER for a column that already exists errors harmlessly, so just run the
-- remaining lines on their own (or apply this whole file column-by-column).
ALTER TABLE pageviews ADD COLUMN asn INTEGER;
ALTER TABLE pageviews ADD COLUMN org TEXT;
ALTER TABLE pageviews ADD COLUMN ref TEXT;
CREATE INDEX IF NOT EXISTS idx_pageviews_org ON pageviews(org);

-- Migration: add the ?source= landing-link tag (e.g. ?source=CV). Run before
-- (or together with) deploying the track.js change, since the insert names this
-- column. A re-run errors harmlessly if the column already exists.
ALTER TABLE pageviews ADD COLUMN source TEXT;
CREATE INDEX IF NOT EXISTS idx_pageviews_source ON pageviews(source);

-- Migration: add dwell-time tracking. `pvid` is a per-pageview id sent on load;
-- `dur` is the active time on that page in ms, written by the sendBeacon POST
-- when the visitor leaves. Apply before/with the track.js + Base.astro deploy
-- (the insert names pvid). Re-runs error harmlessly if a column already exists.
ALTER TABLE pageviews ADD COLUMN pvid TEXT;
ALTER TABLE pageviews ADD COLUMN dur INTEGER;
CREATE INDEX IF NOT EXISTS idx_pageviews_pvid ON pageviews(pvid);

-- Migration: add the downloads table (file-download tracking, e.g. the CV PDF).
-- Kept separate from pageviews so downloads never inflate page-view/dwell stats.
-- Apply before/with the track.js + Base.astro + insights.js deploy. Re-running
-- is harmless (IF NOT EXISTS).
CREATE TABLE IF NOT EXISTS downloads (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  ts      INTEGER NOT NULL,
  path    TEXT    NOT NULL,
  city    TEXT,
  region  TEXT,
  country TEXT,
  lat     REAL,
  lng     REAL,
  asn     INTEGER,
  org     TEXT,
  ref     TEXT,
  vid     TEXT    NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_downloads_ts   ON downloads(ts);
CREATE INDEX IF NOT EXISTS idx_downloads_vid  ON downloads(vid);
CREATE INDEX IF NOT EXISTS idx_downloads_path ON downloads(path);

-- The site wasn't public before bot-filtering was added, so the pre-launch rows
-- are all crawlers/scanners. To start clean, also run:
--   npx wrangler d1 execute site-analytics --remote --command "DELETE FROM pageviews;"
