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
  asn     INTEGER,            -- network autonomous-system number (Cloudflare)
  org     TEXT,               -- network organization / ISP (cf.asOrganization);
                              -- often the company or institution for corp/campus visits
  ref     TEXT,               -- external referrer hostname that sent the visitor
  source  TEXT,               -- ?source= tag from the landing link (e.g. "CV")
  pvid    TEXT,               -- per-pageview id, links a view to its dwell report
  dur     INTEGER,            -- active time on the page, ms (filled on page leave)
  scroll  INTEGER,            -- max scroll depth reached, percent 0-100 (page leave)
  vid     TEXT    NOT NULL    -- anonymous per-visitor id (cookie)
);

CREATE INDEX IF NOT EXISTS idx_pageviews_ts     ON pageviews(ts);
CREATE INDEX IF NOT EXISTS idx_pageviews_vid    ON pageviews(vid);
CREATE INDEX IF NOT EXISTS idx_pageviews_org    ON pageviews(org);
CREATE INDEX IF NOT EXISTS idx_pageviews_source ON pageviews(source);
CREATE INDEX IF NOT EXISTS idx_pageviews_pvid   ON pageviews(pvid);

-- File downloads (kept separate from pageviews so they never inflate page-view
-- or dwell metrics). One row per click on a downloadable file link (the CV PDF,
-- papers, etc.), recorded by track.js with the same bot filtering + Cloudflare
-- geo/network attribution as a pageview, so the dashboard can show how many
-- times the CV was downloaded and from where / which organization.
CREATE TABLE IF NOT EXISTS downloads (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  ts      INTEGER NOT NULL,   -- event time, unix milliseconds
  path    TEXT    NOT NULL,   -- file downloaded, e.g. /files/Atilla_Saadat_CV.pdf
  city    TEXT,               -- from Cloudflare request geo
  region  TEXT,               -- state / province
  country TEXT,               -- ISO-2 country code
  lat     REAL,               -- approximate latitude  (Cloudflare geo)
  lng     REAL,               -- approximate longitude (Cloudflare geo)
  asn     INTEGER,            -- network autonomous-system number (Cloudflare)
  org     TEXT,               -- network organization / ISP (cf.asOrganization)
  ref     TEXT,               -- external referrer hostname, if any
  vid     TEXT    NOT NULL    -- anonymous per-visitor id (cookie)
);

CREATE INDEX IF NOT EXISTS idx_downloads_ts   ON downloads(ts);
CREATE INDEX IF NOT EXISTS idx_downloads_vid  ON downloads(vid);
CREATE INDEX IF NOT EXISTS idx_downloads_path ON downloads(path);

-- Outbound / CTA clicks (email, social profiles, external links). Recorded by
-- track.js with the same bot filtering + geo/network attribution as a pageview,
-- keyed by vid so the dashboard can attribute a contact/social click to a
-- visitor's session (a recruiter clicking the email is a near-conversion).
CREATE TABLE IF NOT EXISTS events (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  ts      INTEGER NOT NULL,   -- event time, unix milliseconds
  kind    TEXT    NOT NULL,   -- 'email' | 'social' | 'outbound'
  target  TEXT,               -- destination (the email address, or external host)
  path    TEXT,               -- page the click happened on
  city    TEXT,
  region  TEXT,
  country TEXT,
  lat     REAL,
  lng     REAL,
  asn     INTEGER,
  org     TEXT,               -- network organization / ISP (cf.asOrganization)
  vid     TEXT    NOT NULL    -- anonymous per-visitor id (cookie)
);

CREATE INDEX IF NOT EXISTS idx_events_ts   ON events(ts);
CREATE INDEX IF NOT EXISTS idx_events_vid  ON events(vid);
CREATE INDEX IF NOT EXISTS idx_events_kind ON events(kind);
