// Test harness for the analytics Cloudflare Functions (/functions/track.js and
// /functions/insights.js).
//
// These Functions only ever run at Cloudflare's edge, so `astro preview` never
// executes them and the browser suite cannot reach them. They are exercised
// directly here instead, against a throwaway in-memory SQLite database created
// from the real schema.sql.
//
// IMPORTANT: nothing in here can touch the production analytics database. The
// database is `:memory:` (node:sqlite), created fresh per test and discarded
// when the process exits. There is no wrangler, no network call, and no
// database_id anywhere in this file.

import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const SCHEMA = readFileSync(fileURLToPath(new URL('../../schema.sql', import.meta.url)), 'utf8');

// D1 hands back rows as plain objects; node:sqlite uses null-prototype ones.
// Normalize so `{...row}`-style assertions and property reads behave the same.
const plain = <T>(row: T) => (row == null ? row : ({ ...row } as T));

// node:sqlite rejects `undefined` binds and may return BigInt row ids.
const bindable = (v: unknown) => (v === undefined ? null : (v as never));

/**
 * Minimal stand-in for the D1 binding (`env.DB`), backed by real SQLite so the
 * Functions' actual SQL is executed. Implements the surface the Functions use:
 * prepare().bind().run() / .all() / .first().
 */
export interface TestDb {
  /** The `env.DB` value to hand to a Function. */
  binding: unknown;
  /** Run an arbitrary query in a test (assertions, seeding). */
  query<T = Record<string, unknown>>(sql: string, ...args: unknown[]): T[];
  /** Row count of a table. */
  count(table: string): number;
  close(): void;
}

export function createTestDb(): TestDb {
  const db = new DatabaseSync(':memory:');
  db.exec(SCHEMA);

  const statement = (sql: string, args: unknown[] = []) => ({
    bind: (...a: unknown[]) => statement(sql, a),
    async run() {
      const r = db.prepare(sql).run(...args.map(bindable));
      return {
        success: true,
        meta: { changes: Number(r.changes), last_row_id: Number(r.lastInsertRowid) },
      };
    },
    async all() {
      const results = db.prepare(sql).all(...args.map(bindable)).map(plain);
      return { success: true, results, meta: {} };
    },
    async first(column?: string) {
      const row = plain(db.prepare(sql).get(...args.map(bindable)));
      if (row === undefined || row === null) return null;
      return column ? (row as Record<string, unknown>)[column] : row;
    },
  });

  return {
    binding: { prepare: (sql: string) => statement(sql) },
    query: (sql, ...args) => db.prepare(sql).all(...args.map(bindable)).map(plain) as never,
    count: (table) =>
      Number((db.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number }).n),
    close: () => db.close(),
  };
}

// --- Request fixtures -------------------------------------------------------

/** Cloudflare geo/network metadata for a plausible residential visitor. */
export const HOME_CF = {
  city: 'Toronto',
  region: 'Ontario',
  country: 'CA',
  latitude: '43.6532',
  longitude: '-79.3832',
  asn: 812,
  asOrganization: 'Rogers Communications Canada Inc.',
};

/** Headers a real browser sends for the beacon's `new Image().src` load. */
export const BROWSER_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36',
  'Accept-Language': 'en-CA,en;q=0.9',
  'Sec-Fetch-Dest': 'image',
  'Sec-Fetch-Site': 'same-origin',
};

export interface BeaconOptions {
  headers?: Record<string, string | undefined>;
  cookie?: string;
  cf?: Record<string, unknown> | undefined;
  method?: string;
}

/**
 * A request object shaped like the one a Pages Function receives. The Functions
 * only read `url`, `method`, `headers` and `cf`, and `cf` cannot be set on a
 * real `Request`, so a plain object is used (same approach as middleware.spec).
 */
export function beacon(query: string, opts: BeaconOptions = {}) {
  const headers: Record<string, string> = {};
  for (const [k, v] of Object.entries({ ...BROWSER_HEADERS, ...opts.headers })) {
    if (v !== undefined) headers[k] = v;
  }
  if (opts.cookie) headers.Cookie = opts.cookie;
  return {
    url: `https://atillasaadat.com/track${query}`,
    method: opts.method || 'GET',
    headers: new Headers(headers),
    cf: 'cf' in opts ? opts.cf : HOME_CF,
  };
}

/** The `vid` a Set-Cookie header assigned, or null when none was set. */
export function vidFrom(res: Response): string | null {
  const m = (res.headers.get('Set-Cookie') || '').match(/(?:^|,\s*)vid=([^;]+)/);
  return m ? m[1] : null;
}
