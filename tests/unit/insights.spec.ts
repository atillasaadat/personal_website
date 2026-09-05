import { test, expect } from '@playwright/test';
// @ts-expect-error - plain JS Cloudflare Pages Function, no types
import { onRequestGet as track } from '../../functions/track.js';
// @ts-expect-error - plain JS Cloudflare Pages Function, no types
import { onRequestPost as trackDwell } from '../../functions/track.js';
// @ts-expect-error - plain JS Cloudflare Pages Function, no types
import { onRequestGet as dashboard, onRequestPost as dashboardPost } from '../../functions/insights.js';
import { createTestDb, beacon, type TestDb } from './_analytics';

// End-to-end check of the analytics pipeline against a throwaway in-memory
// database: a visit goes through the real beacon (track.js) and must then show
// up on the real dashboard (insights.js). This is the "are visitors actually
// being recorded and displayed" question, tested without the production DB.

const PASSWORD = 'test-password';

let db: TestDb;
const env = () => ({ DB: db.binding, ADMIN_PASSWORD: PASSWORD });

test.beforeEach(() => {
  db = createTestDb();
});
test.afterEach(() => {
  db.close();
});

/** Send a pageview beacon as `vid`, returning the pageview id used. */
async function visit(vid: string, path: string, opts: { dwellMs?: number; scroll?: number } = {}) {
  const pvid = `pv-${vid}-${path.replace(/\W+/g, '')}`;
  await track({
    request: beacon(`?p=${encodeURIComponent(path)}&i=${pvid}`, { cookie: `vid=${vid}` }),
    env: env(),
  });
  if (opts.dwellMs) {
    await trackDwell({
      request: beacon(`?i=${pvid}&d=${opts.dwellMs}&sd=${opts.scroll ?? 80}`, {
        cookie: `vid=${vid}`,
        method: 'POST',
      }),
      env: env(),
    });
  }
  return pvid;
}

/** GET /insights with the given cookies. */
function view(query = '?range=all', cookie = `ipw=${PASSWORD}`) {
  return dashboard({
    request: new Request(`https://atillasaadat.com/insights${query}`, {
      headers: cookie ? { Cookie: cookie } : {},
    }),
    env: env(),
  });
}

/** Pull the dashboard's stat cards out of the rendered HTML as label -> value. */
function cards(html: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of html.matchAll(
    /<div class="n">([\s\S]*?)<\/div><div class="l">([\s\S]*?)<\/div>/g,
  )) {
    out[m[2].trim()] = m[1].trim();
  }
  return out;
}

test.describe('password gate', () => {
  test('refuses to run without ADMIN_PASSWORD configured', async () => {
    const res = await dashboard({
      request: new Request('https://atillasaadat.com/insights'),
      env: { DB: db.binding },
    });
    expect(res.status).toBe(500);
    expect(await res.text()).toContain('ADMIN_PASSWORD');
  });

  test('shows the login prompt with no cookie, and never the data', async () => {
    await visit('v1', '/');
    const res = await view('?range=all', '');
    expect(res.status).toBe(200);
    const html = await res.text();
    expect(html).toContain('type="password"');
    expect(html).not.toContain('Visitor Insights');
    expect(html).not.toContain(PASSWORD);
  });

  test('reports a wrong password instead of silently re-prompting', async () => {
    const html = await (await view('?range=all', 'ipw=nope')).text();
    expect(html).toContain('Wrong password.');
    expect(html).not.toContain('Visitor Insights');
  });

  test('is not fooled by a cookie whose name merely ends in the auth cookie', async () => {
    const html = await (await view('?range=all', `xipw=${PASSWORD}`)).text();
    expect(html).toContain('type="password"');
  });

  test('never caches the dashboard or lets it be framed', async () => {
    const res = await view();
    expect(res.headers.get('Cache-Control')).toBe('no-store');
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
  });
});

test('shows a recorded visit end to end: beacon in, dashboard out', async () => {
  // Two pages -> engaged by page count.
  await visit('visitor-a', '/');
  await visit('visitor-a', '/post/turion-space');
  // One page but real dwell -> engaged by time on page.
  await visit('visitor-b', '/research', { dwellMs: 45_000, scroll: 90 });

  const html = await (await view()).text();
  const stat = cards(html);

  expect(html).toContain('Visitor Insights');
  expect(stat['Engaged visitors']).toBe('2');
  expect(stat['Engaged views']).toBe('3');
  expect(stat['Countries']).toBe('1');

  // The pages, the network org and the location all surface.
  expect(html).toContain('/post/turion-space');
  expect(html).toContain('/research');
  expect(html).toContain('Rogers Communications Canada Inc.');
  expect(html).toContain('Toronto');
});

test('the default engaged view hides single-page zero-dwell visits; data=all shows them', async () => {
  await visit('visitor-a', '/');
  await visit('visitor-a', '/cv');
  await visit('visitor-c', '/'); // one page, no dwell report

  // Engaged (the default the dashboard opens on).
  const engaged = cards(await (await view()).text());
  expect(engaged['Engaged visitors']).toBe('1');
  expect(engaged['Engaged views']).toBe('2');

  // Everything actually recorded.
  const all = cards(await (await view('?range=all&data=all')).text());
  expect(all['Unique visitors']).toBe('2');
  expect(all['Page views']).toBe('3');

  // A dwell report promotes the single-page visitor into the engaged view.
  await visit('visitor-d', '/about', { dwellMs: 30_000 });
  const after = cards(await (await view()).text());
  expect(after['Engaged visitors']).toBe('2');
});

test('surfaces time on page, downloads and outbound clicks', async () => {
  await visit('visitor-a', '/cv', { dwellMs: 60_000, scroll: 100 });
  await track({
    request: beacon('?e=dl&p=%2Ffiles%2FAtilla_Saadat_CV.pdf', { cookie: 'vid=visitor-a' }),
    env: env(),
  });
  await track({
    request: beacon('?e=click&k=email&t=contact%40atillasaadat.com&p=%2Fcv', {
      cookie: 'vid=visitor-a',
    }),
    env: env(),
  });

  const html = await (await view()).text();
  const stat = cards(html);
  expect(stat['CV downloads']).toBe('1');
  expect(stat['Avg. time on site']).not.toBe('&middot;');
  expect(html).toContain('Atilla_Saadat_CV.pdf');
  expect(html).toContain('contact@atillasaadat.com');
});

test('excludes the owner: viewing the dashboard drops a notrack cookie and deletes own visits', async () => {
  await visit('owner-machine', '/');
  await visit('owner-machine', '/cv');
  await track({
    request: beacon('?e=dl&p=%2Ffiles%2FAtilla_Saadat_CV.pdf', { cookie: 'vid=owner-machine' }),
    env: env(),
  });
  await visit('real-visitor', '/');
  await visit('real-visitor', '/research');

  const res = await view('?range=all', `ipw=${PASSWORD}; vid=owner-machine`);
  expect(res.headers.get('Set-Cookie')).toContain('notrack=1');

  expect(db.query('SELECT * FROM pageviews WHERE vid = ?', 'owner-machine')).toHaveLength(0);
  expect(db.query('SELECT * FROM downloads WHERE vid = ?', 'owner-machine')).toHaveLength(0);
  expect(db.count('pageviews'), "the real visitor's rows must survive").toBe(2);
});

test.describe('clear all data', () => {
  const clear = (cookie: string | null, headers: Record<string, string> = {}) =>
    dashboardPost({
      request: new Request('https://atillasaadat.com/insights', {
        method: 'POST',
        headers: { ...(cookie ? { Cookie: cookie } : {}), ...headers },
        body: new URLSearchParams({ action: 'clear' }),
      }),
      env: env(),
    });

  const seed = async () => {
    await visit('visitor-a', '/');
    await track({
      request: beacon('?e=dl&p=%2Ffiles%2FAtilla_Saadat_CV.pdf', { cookie: 'vid=visitor-a' }),
      env: env(),
    });
    await track({
      request: beacon('?e=click&k=social&t=linkedin.com&p=%2F', { cookie: 'vid=visitor-a' }),
      env: env(),
    });
  };

  test('wipes every table when authorized', async () => {
    await seed();
    const res = await clear(`ipw=${PASSWORD}`);
    expect(res.status).toBeLessThan(400);
    for (const table of ['pageviews', 'downloads', 'events']) {
      expect(db.count(table), `${table} must be cleared`).toBe(0);
    }
  });

  test('rejects an unauthenticated wipe', async () => {
    await seed();
    expect((await clear(null)).status).toBe(403);
    expect(db.count('pageviews')).toBe(1);
  });

  test('rejects a cross-site wipe even with a valid cookie', async () => {
    await seed();
    const res = await clear(`ipw=${PASSWORD}`, { 'Sec-Fetch-Site': 'cross-site' });
    expect(res.status).toBe(403);
    expect(db.count('pageviews')).toBe(1);
  });
});

test('renders an empty dashboard rather than failing when there is no data', async () => {
  const stat = cards(await (await view()).text());
  expect(stat['Engaged visitors']).toBe('0');
  expect(stat['Engaged views']).toBe('0');
});
