import { test, expect } from '@playwright/test';
// @ts-expect-error - plain JS Cloudflare Pages Function, no types
import { onRequest } from '../../functions/_middleware.js';

// The country block runs at the edge on Cloudflare, so it never executes under
// `astro preview` and the browser tests cannot reach it. Exercise the function
// directly instead: it is the one piece of code that can make the whole site
// unreachable, so a wrong country match must fail loudly here.

const ctx = (country: string | null, { headerOnly = false } = {}) => ({
  request: {
    cf: headerOnly || country === null ? undefined : { country },
    headers: new Headers(country && headerOnly ? { 'CF-IPCountry': country } : {}),
  },
  next: async () => new Response('the site', { status: 200 }),
});

test('blocks mainland China', async () => {
  for (const c of ['CN', 'cn']) {
    const res = await onRequest(ctx(c));
    expect(res.status, `country ${c}`).toBe(403);
    expect(await res.text()).toContain('not available in your region');
  }
});

test('reads the country from CF-IPCountry when request.cf is absent', async () => {
  const res = await onRequest(ctx('CN', { headerOnly: true }));
  expect(res.status).toBe(403);
});

test('the block response is never cached', async () => {
  const res = await onRequest(ctx('CN'));
  expect(res.headers.get('cache-control')).toBe('no-store');
});

test('serves everyone else, and fails open when geo is unknown', async () => {
  // HK/MO/TW are separate ISO codes and deliberately not blocked; T1 is Tor and
  // XX is "unknown", neither of which should lock anyone out by accident.
  for (const c of ['US', 'CA', 'GB', 'JP', 'HK', 'MO', 'TW', 'T1', 'XX', '']) {
    const res = await onRequest(ctx(c));
    expect(res.status, `country ${JSON.stringify(c)} must not be blocked`).toBe(200);
  }
  const noGeo = await onRequest(ctx(null));
  expect(noGeo.status, 'no geo data at all must not be blocked').toBe(200);
});

// The geo cookie feeds the day/night theme in Base.astro's head script.
const geoCtx = ({ cf = {}, cookie = '', type = 'text/html; charset=utf-8' } = {}) => ({
  request: { cf: { country: 'US', ...cf }, headers: new Headers(cookie ? { Cookie: cookie } : {}) },
  next: async () => new Response('<!doctype html>', { status: 200, headers: { 'content-type': type } }),
});
const LA = { latitude: '34.05223', longitude: '-118.24368' };

test('hands HTML pages the visitor location, rounded to ~10 km', async () => {
  const res = await onRequest(geoCtx({ cf: LA }));
  const c = res.headers.get('set-cookie') || '';
  expect(c).toContain('geo=34.1,-118.2;');
  expect(c).toContain('Path=/');
  expect(c).toContain('SameSite=Lax');
  expect(c).toContain('Secure');
  expect(await res.text()).toBe('<!doctype html>');
});

test('leaves assets, repeat views and unknown locations without a geo cookie', async () => {
  const asset = await onRequest(geoCtx({ cf: LA, type: 'image/jpeg' }));
  expect(asset.headers.get('set-cookie'), 'asset').toBeNull();
  const repeat = await onRequest(geoCtx({ cf: LA, cookie: 'vid=abc; geo=34.1,-118.2' }));
  expect(repeat.headers.get('set-cookie'), 'unchanged cookie').toBeNull();
  const moved = await onRequest(geoCtx({ cf: LA, cookie: 'geo=40.7,-74.0' }));
  expect(moved.headers.get('set-cookie'), 'moved city').toContain('geo=34.1,-118.2;');
  const unknown = await onRequest(geoCtx());
  expect(unknown.headers.get('set-cookie'), 'no coordinates').toBeNull();
});
