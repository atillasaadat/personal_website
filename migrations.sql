-- Migration: add approximate lat/lng to an existing pageviews table.
-- Apply once to a database created with the original schema:
--   npx wrangler d1 execute site-analytics --remote --file=./migrations.sql
--
-- SQLite ignores errors here only if run column-by-column; if a column already
-- exists the statement errors harmlessly and the other can be run on its own.
ALTER TABLE pageviews ADD COLUMN lat REAL;
ALTER TABLE pageviews ADD COLUMN lng REAL;

-- The site wasn't public before bot-filtering was added, so the pre-launch rows
-- are all crawlers/scanners. To start clean, also run:
--   npx wrangler d1 execute site-analytics --remote --command "DELETE FROM pageviews;"
