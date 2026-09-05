import { test, expect } from '@playwright/test';
// @ts-expect-error - plain JS Cloudflare Pages Function, no types
import { onRequestGet, onRequestPost } from '../../functions/track.js';
import { createTestDb, beacon, vidFrom, type TestDb } from './_analytics';

// The pageview beacon is the one place a visit can be lost silently: every DB
// write in track.js is wrapped in a try/catch that swallows the error, because
// analytics must never break the page. That is the right call in production and
// exactly why it needs tests: a schema drift or a bad bind would make the site
// stop recording visitors with no error anywhere. Every test below runs the real
// INSERT against the real schema.sql, in a throwaway in-memory database.

let db: TestDb;
const env = () => ({ DB: db.binding });

test.beforeEach(() => {
  db = createTestDb();
});
test.afterEach(() => {
  db.close();
});

const VID = 'a1b2c3d4-0000-4000-8000-000000000001';
const COOKIE = `vid=${VID}`;

test('records a pageview from a real browser, with geo and network attribution', async () => {
  const res = await onRequestGet({
    request: beacon(
      '?p=%2Fpost%2Fturion-space&r=https%3A%2F%2Fwww.google.com%2Fsearch&s=CV&i=pv-1',
      { cookie: COOKIE },
    ),
    env: env(),
  });

  expect(res.status).toBe(200);
  expect(res.headers.get('Content-Type')).toBe('image/gif');
  expect(res.headers.get('Cache-Control')).toBe('no-store, max-age=0');

  // If this is 0, the beacon is silently dropping visits (the failure mode the
  // swallowed try/catch hides in production).
  expect(db.count('pageviews'), 'the pageview INSERT must succeed against schema.sql').toBe(1);

  const [row] = db.query<Record<string, unknown>>('SELECT * FROM pageviews');
  expect(row).toMatchObject({
    path: '/post/turion-space',
    city: 'Toronto',
    region: 'Ontario',
    country: 'CA',
    asn: 812,
    org: 'Rogers Communications Canada Inc.',
    ref: 'google.com',
    source: 'CV',
    pvid: 'pv-1',
    vid: VID,
  });
  expect(row.lat).toBeCloseTo(43.6532, 3);
  expect(row.lng).toBeCloseTo(-79.3832, 3);
  expect(Number(row.ts)).toBeGreaterThan(Date.now() - 60_000);
  // Dwell and scroll are filled in later by the sendBeacon POST.
  expect(row.dur).toBeNull();
  expect(row.scroll).toBeNull();
});

test('assigns a vid cookie on the first visit and reuses the one it is given', async () => {
  const first = await onRequestGet({ request: beacon('?p=%2F'), env: env() });
  const assigned = vidFrom(first);
  expect(assigned, 'a first-time visitor must be given a vid cookie').toMatch(
    /^[0-9a-f-]{36}$/,
  );
  expect(first.headers.get('Set-Cookie')).toContain('HttpOnly');

  const second = await onRequestGet({
    request: beacon('?p=%2Fcv', { cookie: `vid=${assigned}` }),
    env: env(),
  });
  expect(vidFrom(second), 'a returning visitor keeps their vid').toBeNull();

  const vids = db.query<{ vid: string }>('SELECT DISTINCT vid FROM pageviews');
  expect(vids).toHaveLength(1);
  expect(vids[0].vid).toBe(assigned);
});

test('defaults the path to / and truncates an oversized one', async () => {
  await onRequestGet({ request: beacon('', { cookie: COOKIE }), env: env() });
  await onRequestGet({
    request: beacon(`?p=%2F${'x'.repeat(900)}`, { cookie: COOKIE }),
    env: env(),
  });
  const paths = db.query<{ path: string }>('SELECT path FROM pageviews ORDER BY id');
  expect(paths[0].path).toBe('/');
  expect(paths[1].path).toHaveLength(512);
});

test.describe('bot filtering', () => {
  const rejected: Array<[string, Parameters<typeof beacon>[1]]> = [
    ['an empty user agent', { headers: { 'User-Agent': '' } }],
    ['a stub user agent', { headers: { 'User-Agent': 'Mozilla' } }],
    ['a non-browser user agent', { headers: { 'User-Agent': 'curl/8.7.1 some padding here' } }],
    [
      'a declared crawler',
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; GPTBot/1.2; +https://openai.com/gptbot',
        },
      },
    ],
    ['a non-image fetch destination', { headers: { 'Sec-Fetch-Dest': 'document' } }],
    ['a cross-site fetch', { headers: { 'Sec-Fetch-Site': 'cross-site' } }],
    ['no Accept-Language', { headers: { 'Accept-Language': undefined } }],
    ['a Cloudflare-verified bot', { cf: { country: 'US', verifiedBot: true } }],
    [
      'a VPS / hosting network',
      { cf: { country: 'US', asOrganization: 'DigitalOcean, LLC' } },
    ],
    [
      'a residential-proxy vendor',
      { cf: { country: 'US', asOrganization: 'Bright Data Ltd.' } },
    ],
  ];

  for (const [name, opts] of rejected) {
    test(`drops ${name}`, async () => {
      const res = await onRequestGet({
        request: beacon('?p=%2F', { cookie: COOKIE, ...opts }),
        env: env(),
      });
      // Still serves the pixel: the filter must be invisible to the client.
      expect(res.status).toBe(200);
      expect(db.count('pageviews'), `${name} must not be recorded`).toBe(0);
    });
  }

  // Real people browse from these. Safari's iCloud Private Relay egresses
  // through Akamai, Fastly and Cloudflare, so treating those as hosting
  // networks silently discards a large share of genuine Mac/iPhone visitors.
  const accepted: Array<[string, string]> = [
    ['iCloud Private Relay via Akamai', 'Akamai Technologies, Inc.'],
    ['iCloud Private Relay via Fastly', 'Fastly, Inc.'],
    ['iCloud Private Relay via Cloudflare', 'Cloudflare, Inc.'],
    ['a corporate network', 'Varda Space Industries'],
    ['a university network', 'York University'],
    ['a mobile carrier', 'T-MOBILE-AS21928'],
    ['a cloud egress that could be a real employer', 'AMAZON-02'],
  ];

  for (const [name, org] of accepted) {
    test(`records ${name}`, async () => {
      await onRequestGet({
        request: beacon('?p=%2F', {
          cookie: COOKIE,
          cf: { country: 'US', asOrganization: org },
        }),
        env: env(),
      });
      expect(db.count('pageviews'), `${name} is a real visitor and must be recorded`).toBe(1);
    });
  }
});

test('honors the owner opt-out cookie', async () => {
  const res = await onRequestGet({
    request: beacon('?p=%2F', { cookie: `notrack=1; vid=${VID}` }),
    env: env(),
  });
  expect(res.status).toBe(200);
  expect(vidFrom(res), 'an opted-out browser is not even given a vid').toBeNull();
  expect(db.count('pageviews')).toBe(0);
});

test('treats an internal referrer as direct and keeps external ones as bare hosts', async () => {
  const cases: Array<[string, string | null]> = [
    ['https://www.linkedin.com/feed/', 'linkedin.com'],
    ['https://scholar.google.com/citations', 'scholar.google.com'],
    ['https://atillasaadat.com/cv', null],
    ['https://www.atillasaadat.me/', null],
    ['not-a-url', null],
    ['', null],
  ];
  for (const [referrer, expected] of cases) {
    await onRequestGet({
      request: beacon(`?p=%2F&r=${encodeURIComponent(referrer)}`, { cookie: COOKIE }),
      env: env(),
    });
  }
  const rows = db.query<{ ref: string | null }>('SELECT ref FROM pageviews ORDER BY id');
  expect(rows.map((r) => r.ref)).toEqual(cases.map(([, e]) => e));
});

test('sanitizes the visitor-supplied source tag and pageview id', async () => {
  await onRequestGet({
    request: beacon(
      `?p=%2F&s=${encodeURIComponent("  CV<script>  ")}&i=${encodeURIComponent('pv/../1')}`,
      { cookie: COOKIE },
    ),
    env: env(),
  });
  const [row] = db.query<{ source: string; pvid: string }>('SELECT source, pvid FROM pageviews');
  expect(row.source).toBe('CVscript');
  expect(row.pvid).toBe('pv1');
});

test('records a file download in the downloads table, not pageviews', async () => {
  await onRequestGet({
    request: beacon('?e=dl&p=%2Ffiles%2FAtilla_Saadat_CV.pdf', { cookie: COOKIE }),
    env: env(),
  });
  expect(db.count('pageviews'), 'downloads must never inflate page-view stats').toBe(0);
  expect(db.count('downloads')).toBe(1);
  expect(db.query('SELECT * FROM downloads')[0]).toMatchObject({
    path: '/files/Atilla_Saadat_CV.pdf',
    country: 'CA',
    org: 'Rogers Communications Canada Inc.',
    vid: VID,
  });
});

test('records email, social and outbound clicks in the events table', async () => {
  const clicks: Array<[string, string, string]> = [
    ['email', 'contact%40atillasaadat.com', 'contact@atillasaadat.com'],
    ['social', 'linkedin.com', 'linkedin.com'],
    ['outbound', 'celestrak.org', 'celestrak.org'],
  ];
  for (const [kind, target] of clicks) {
    await onRequestGet({
      request: beacon(`?e=click&k=${kind}&t=${target}&p=%2F`, { cookie: COOKIE }),
      env: env(),
    });
  }
  expect(db.count('pageviews')).toBe(0);
  const rows = db.query<{ kind: string; target: string }>(
    'SELECT kind, target FROM events ORDER BY id',
  );
  expect(rows.map((r) => [r.kind, r.target])).toEqual(clicks.map(([k, , t]) => [k, t]));
});

test('falls back to outbound for an unrecognizable click kind', async () => {
  await onRequestGet({
    request: beacon('?e=click&k=%21%40%23123&t=example.com&p=%2F', { cookie: COOKIE }),
    env: env(),
  });
  expect(db.query<{ kind: string }>('SELECT kind FROM events')[0].kind).toBe('outbound');
});

test.describe('dwell + scroll reports (the sendBeacon POST)', () => {
  const seed = async (pvid = 'pv-1') => {
    await onRequestGet({ request: beacon(`?p=%2Fresearch&i=${pvid}`, { cookie: COOKIE }), env: env() });
  };
  const report = (query: string, cookie = COOKIE) =>
    onRequestPost({ request: beacon(query, { cookie, method: 'POST' }), env: env() });
  const row = () =>
    db.query<{ dur: number | null; scroll: number | null }>('SELECT dur, scroll FROM pageviews')[0];

  test('writes the duration and scroll depth onto the matching pageview', async () => {
    await seed();
    const res = await report('?i=pv-1&d=45000&sd=72');
    expect(res.status).toBe(204);
    expect(row()).toEqual({ dur: 45000, scroll: 72 });
  });

  test('keeps the largest value seen and ignores smaller follow-ups', async () => {
    await seed();
    await report('?i=pv-1&d=45000&sd=72');
    await report('?i=pv-1&d=90000&sd=95');
    await report('?i=pv-1&d=1000&sd=10');
    expect(row()).toEqual({ dur: 90000, scroll: 95 });
  });

  test('caps absurd values', async () => {
    await seed();
    await report('?i=pv-1&d=999999999&sd=4000');
    expect(row()).toEqual({ dur: 7200000, scroll: 100 });
  });

  test('ignores a report for another visitor, an unknown pageview, or a bad value', async () => {
    await seed();
    await report('?i=pv-1&d=45000&sd=72', 'vid=someone-else');
    await report('?i=pv-does-not-exist&d=45000&sd=72');
    await report('?i=pv-1&d=notanumber&sd=notanumber');
    await report('?i=pv-1&d=-5&sd=-5');
    expect(row()).toEqual({ dur: null, scroll: null });
  });

  test('does nothing for an opted-out browser', async () => {
    await seed();
    const res = await report('?i=pv-1&d=45000&sd=72', `notrack=1; ${COOKIE}`);
    expect(res.status).toBe(204);
    expect(row()).toEqual({ dur: null, scroll: null });
  });
});

test('serves the pixel and never throws when the database binding is missing', async () => {
  const res = await onRequestGet({ request: beacon('?p=%2F', { cookie: COOKIE }), env: {} });
  expect(res.status).toBe(200);
  expect(res.headers.get('Content-Type')).toBe('image/gif');
  const post = await onRequestPost({
    request: beacon('?i=pv-1&d=1000', { cookie: COOKIE, method: 'POST' }),
    env: {},
  });
  expect(post.status).toBe(204);
});
