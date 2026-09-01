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

  return next();
}
