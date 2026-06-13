// Pageview beacon endpoint. The site loads `/track?p=<path>` as a 1x1 image
// (via a `<script>` that runs `new Image().src=...`) on every page, so only
// JS-executing clients reach here at all. This Function additionally filters
// out bots/crawlers/scanners so only genuine human visits are recorded into D1.
// Analytics must never break the page, so every failure is swallowed.

const PIXEL = Uint8Array.from([
  0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0x01, 0x00, 0x01, 0x00, 0x80, 0x00, 0x00,
  0x00, 0x00, 0x00, 0xff, 0xff, 0xff, 0x21, 0xf9, 0x04, 0x01, 0x00, 0x00, 0x00,
  0x00, 0x2c, 0x00, 0x00, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0x02, 0x02,
  0x44, 0x01, 0x00, 0x3b,
]);

// Known bot / automation / preview / monitoring user-agent signatures.
const BOT_UA = /bot|crawl|spider|slurp|bingpreview|mediapartners|facebookexternalhit|embedly|quora|pinterest|slackbot|telegrambot|whatsapp|discordbot|twitterbot|linkedinbot|redditbot|applebot|petalbot|yandex|baidu|sogou|semrush|ahrefs|mj12|dotbot|dataforseo|bytespider|gptbot|claudebot|ccbot|perplexity|amazonbot|headless|phantomjs|puppeteer|playwright|selenium|lighthouse|chrome-lighthouse|pagespeed|gtmetrix|pingdom|uptime|statuscake|monitor|newrelic|datadog|curl|wget|python-requests|python-urllib|java\/|go-http|node-fetch|axios|got\s|httpx|okhttp|scrapy|libwww|cf-/i;

// Decide whether a request to the beacon looks like a real human browser.
// Conservative: when in doubt about a *modern* signal, treat as bot.
function isBot(request) {
  const ua = request.headers.get('User-Agent') || '';
  if (!ua || ua.length < 16) return true;          // empty / stub UAs
  if (!/Mozilla\//.test(ua)) return true;          // every real browser sends this
  if (BOT_UA.test(ua)) return true;                // explicit bot signatures

  // Fetch metadata (sent by all modern browsers). The beacon is an <img> load
  // from our own page, so a genuine request is dest=image, same-origin.
  const dest = request.headers.get('Sec-Fetch-Dest');
  if (dest && dest !== 'image') return true;
  const site = request.headers.get('Sec-Fetch-Site');
  if (site && site !== 'same-origin' && site !== 'same-site') return true;

  // Cloudflare's verified-bot signal (set even on free plans for known crawlers).
  if (request.cf && request.cf.verifiedBot) return true;

  return false;
}

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

  // Drop bots/crawlers/scanners: return the pixel but record nothing.
  if (isBot(request)) {
    return new Response(PIXEL, { headers });
  }

  const lat = parseFloat(cf.latitude);
  const lng = parseFloat(cf.longitude);

  try {
    if (env.DB) {
      await env.DB.prepare(
        'INSERT INTO pageviews (ts, path, city, region, country, lat, lng, vid) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      )
        .bind(
          Date.now(),
          path,
          cf.city || null,
          cf.region || null,
          cf.country || null,
          Number.isFinite(lat) ? lat : null,
          Number.isFinite(lng) ? lng : null,
          vid,
        )
        .run();
    }
  } catch (e) {
    // ignore: a failed analytics write must not affect the visitor
  }

  return new Response(PIXEL, { headers });
}
