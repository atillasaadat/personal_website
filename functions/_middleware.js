// Sitewide request filter, run by Cloudflare Pages ahead of every request
// (static assets included) before it reaches the other Functions.
//
// Country blocking: requests from the listed ISO 3166-1 alpha-2 countries get a
// 403 and never see the site. Cloudflare resolves the country at the edge, so
// this needs no IP database of our own.
//
// Two things worth knowing about this approach:
//   - It is not airtight. Anyone on a VPN or proxy presents as whatever country
//     the exit node is in, so treat it as a traffic filter, not a security
//     control.
//   - It also blocks people who are merely travelling in those countries.
//
// A Cloudflare WAF custom rule (Security > WAF > Custom rules, expression
// `ip.geoip.country eq "CN"`, action Block) does the same job without spending
// a Functions invocation on every request. This lives in code instead so the
// rule is version-controlled and deploys with the site.
const BLOCKED_COUNTRIES = new Set([
  // Mainland China. Hong Kong (HK), Macau (MO) and Taiwan (TW) are separate
  // ISO codes and are NOT blocked; add them here if that is wanted.
  'CN',
]);

export async function onRequest(context) {
  const { request, next } = context;

  // request.cf.country is set by Cloudflare; CF-IPCountry carries the same
  // value and is the fallback when cf is absent (e.g. local `wrangler dev`).
  // 'T1' (Tor) and 'XX' (unknown) are not matched on.
  const country = request.cf?.country || request.headers.get('CF-IPCountry') || '';

  if (BLOCKED_COUNTRIES.has(country.toUpperCase())) {
    return new Response('403 Forbidden\n\nThis site is not available in your region.\n', {
      status: 403,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        // Never let an edge or browser cache hand this to anyone else.
        'cache-control': 'no-store',
      },
    });
  }

  return withGeoCookie(request, await next());
}

// Day/night theme: the inline script in Base.astro picks light from sunrise to
// sunset at the visitor's location. The browser has no location without a
// permission prompt, so hand it the coordinates Cloudflare already resolved
// for this request, rounded to 0.1 deg (~10 km), city level at best. Only on
// HTML documents (HTML is never edge-cached here, see public/_headers), and
// only when the value changed, so assets and repeat views carry no Set-Cookie.
const GEO_MAX_AGE = 60 * 60 * 24 * 7;

export function withGeoCookie(request, response) {
  const lat = Number.parseFloat(request.cf?.latitude);
  const lon = Number.parseFloat(request.cf?.longitude);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return response;
  if (!(response.headers.get('content-type') || '').includes('text/html')) return response;

  const value = `${lat.toFixed(1)},${lon.toFixed(1)}`;
  const current = /(?:^|;\s*)geo=([^;]*)/.exec(request.headers.get('Cookie') || '')?.[1];
  if (current === value) return response;

  const res = new Response(response.body, response);
  res.headers.append(
    'Set-Cookie',
    `geo=${value}; Path=/; Max-Age=${GEO_MAX_AGE}; SameSite=Lax; Secure`,
  );
  return res;
}
