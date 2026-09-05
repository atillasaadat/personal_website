// Compare the production D1 analytics database against schema.sql.
//
// Why this exists: the `downloads` table was defined in schema.sql and written
// to by track.js from Jul 2026, but was never created on the remote database.
// Every CV download was silently lost for two months, because track.js swallows
// its DB errors by design (analytics must never break the page) and insights.js
// degrades a failed query to an empty table. Nothing anywhere reported it.
//
// The unit tests in tests/unit/ prove the Functions agree with schema.sql. This
// script proves the *deployed database* agrees with schema.sql. Both are needed:
// the tests cannot see production, and production cannot see the tests.
//
// Usage:  npm run db:check          (needs `npx wrangler login`)
// Exits 1 and prints the fix when the remote database is missing anything.

import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const DB_NAME = 'site-analytics';
const schemaPath = fileURLToPath(new URL('../schema.sql', import.meta.url));

// Tables Cloudflare and SQLite manage themselves; not ours to compare.
const INTERNAL = (name) => name.startsWith('sqlite_') || name.startsWith('_cf_');

// D1's query API rejects pragma functions (SQLITE_AUTH), so columns are read by
// parsing the CREATE TABLE text SQLite stores in sqlite_master.sql. Both sides
// go through this same parser, so any quirk in it affects them identically.
function columnsOf(ddl) {
  const body = ddl
    .slice(ddl.indexOf('(') + 1, ddl.lastIndexOf(')'))
    .replace(/--[^\n]*/g, ''); // strip comments: schema.sql's contain commas
  const parts = [];
  let depth = 0;
  let cur = '';
  for (const ch of body) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      parts.push(cur);
      cur = '';
    } else cur += ch;
  }
  parts.push(cur);

  // A trailing table constraint is not a column.
  const CONSTRAINT = new Set(['primary', 'unique', 'check', 'foreign', 'constraint']);
  const cols = new Set();
  for (const part of parts) {
    const name = part.trim().split(/[\s(]/)[0].replace(/["`[\]]/g, '');
    if (!name || CONSTRAINT.has(name.toLowerCase())) continue;
    cols.add(name);
  }
  return cols;
}

const toMap = (rows) => {
  const out = new Map();
  for (const { name, sql } of rows) {
    if (INTERNAL(name) || !sql) continue;
    out.set(name, columnsOf(sql));
  }
  return out;
};

const TABLE_DDL = "SELECT name, sql FROM sqlite_master WHERE type = 'table' ORDER BY name";

/** What schema.sql defines, read by actually executing it. */
function expectedSchema() {
  const db = new DatabaseSync(':memory:');
  db.exec(readFileSync(schemaPath, 'utf8'));
  const map = toMap(db.prepare(TABLE_DDL).all());
  db.close();
  return map;
}

/** What the remote D1 database actually has. */
function remoteSchema() {
  let stdout;
  try {
    stdout = execFileSync(
      'npx',
      ['wrangler', 'd1', 'execute', DB_NAME, '--remote', '--command', TABLE_DDL],
      { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
    );
  } catch (e) {
    const detail = (e.stderr || e.stdout || e.message || '').trim();
    console.error(`Could not read the remote database.\n${detail}`);
    console.error('\nIf this is an auth error, run: npx wrangler login');
    process.exit(2);
  }
  try {
    // wrangler prints a human preamble before the JSON payload.
    return toMap(JSON.parse(stdout.slice(stdout.indexOf('[')))[0].results);
  } catch (e) {
    console.error('Could not parse wrangler output:\n' + stdout);
    process.exit(2);
  }
}

const expected = expectedSchema();
const actual = remoteSchema();
const problems = [];

for (const [table, columns] of expected) {
  if (!actual.has(table)) {
    problems.push(`missing table  ${table}`);
    continue;
  }
  for (const col of columns) {
    if (!actual.get(table).has(col)) problems.push(`missing column ${table}.${col}`);
  }
}

if (problems.length === 0) {
  const summary = [...expected].map(([t, c]) => `${t} (${c.size} cols)`);
  console.log(`Remote "${DB_NAME}" matches schema.sql: ${summary.join(', ')}`);
  process.exit(0);
}

console.error(`Remote "${DB_NAME}" has drifted from schema.sql:\n`);
for (const p of problems) console.error(`  ${p}`);
console.error(
  '\nAnything missing is written to by functions/track.js, which swallows DB errors,' +
    '\nso those events are being silently dropped. Apply the matching statement from' +
    '\nmigrations.sql. Note migrations.sql is not idempotent as a whole (an ALTER for a' +
    '\ncolumn that already exists aborts the run), so apply the missing pieces individually:' +
    `\n\n  npx wrangler d1 execute ${DB_NAME} --remote --command "<the CREATE/ALTER statement>"`,
);
process.exit(1);
