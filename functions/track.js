// Pageview beacon endpoint. The site loads `/track?p=<path>` as a 1x1 image on
// every page; this records the visit (with Cloudflare-provided geo) into D1.
// Analytics must never break the page, so every failure is swallowed.

const PIXEL = Uint8Array.from([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00,
  0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0x21, 0xf9, 0x04, 0x01, 0x00, 0x00, 0x00,
  0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02,
  0x44, 0x01, 0x00, 0x3b,
]);

export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  const path = (url.searchParams.get('p') || '/').slice(0, 512);
  const cf = request.cf || {};

  const cookie = request.headers.get('Cookie') || '';
  let vid = (cookie.match(/(?:^|;\s*)vid=([^;]+)/) || [])[1];

  const headers = new Headers({
    'Content-Type': 'image/gif',
    'Cache-Control': 'no-store, max-age=0',
  });

  if (!vid) {
    vid = crypto.randomUUID();
    // ~400 day cookie; HttpOnly so only the server reads it
    headers.append(
      'Set-Cookie',
      `vid=${vid}; Path=/; Max-Age=34560000; SameSite=Lax; Secure; HttpOnly`,
    );
  }

  try {
    if (env.DB) {
      await env.DB.prepare(
        'INSERT INTO pageviews (ts, path, city, region, country, vid) VALUES (?, ?, ?, ?, ?, ?)',
      )
        .bind(Date.now(), path, cf.city || null, cf.region || null, cf.country || null, vid)
        .run();
    }
  } catch (e) {
    // ignore: a failed analytics write must not affect the visitor
  }

  return new Response(PIXEL, { headers });
}
