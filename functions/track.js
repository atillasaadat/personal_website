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

// Pure datacenter / hosting / VPS / residential-proxy / VPN networks. Real
// visitors browse from residential, mobile, corporate, or campus ISPs, never
// from these networks, so traffic whose Cloudflare-reported network org matches
// is almost certainly an automated scraper (the kind that spoofs a browser UA
// and Sec-Fetch). This includes the residential-proxy and scraping-as-a-service
// vendors (Bright Data, Oxylabs/code200, Smartproxy, HostRoyale, GSL, the
// "COLLYER QUAY" / "VPN Consumer ..." exit labels, "IDC & Cloud service", etc.)
// that were observed slipping through with real-looking headers.
// The big clouds (AWS / GCP / Azure / Oracle) are deliberately NOT listed: a
// real employer at a tech company can egress through them, and a few crawler
// hits from those are preferable to dropping a genuine visit. Those still get
// recorded, with their org shown on the dashboard so they can be judged.
const HOSTING_ORG = /digitalocean|ovh|hetzner|linode|akamai|fastly|vultr|contabo|scaleway|leaseweb|\bm247\b|choopa|psychz|hostwinds|datacamp|colocrossing|quadranet|hostinger|namecheap|godaddy|bluehost|dreamhost|ionos|1&1|gigenet|sharktech|incero|servermania|hostkey|servers\.com|serverius|worldstream|poneytelecom|online s\.?a\.?s|netcup|time4vps|hostpapa|webhosting|hosting solutions|bright ?data|oxylabs|code200|smartproxy|packethub|oculus networks|hostroyale|gsl networks|hurricane electric|cogent|zayo|arelion|collyer quay|\bidc\b|cloud service|\bproxy\b|\bvpn\b|data ?cent(er|re)|dedicated server|virtual server|\bvps\b|colocation|cloud server/i;

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

  // Real browsers negotiate a language; near every spoofing scraper omits it.
  if (!request.headers.get('Accept-Language')) return true;

  const cf = request.cf || {};
  // Cloudflare's verified-bot signal (set even on free plans for known crawlers).
  if (cf.verifiedBot) return true;
  // Traffic originating from pure hosting/VPS networks (see HOSTING_ORG note).
  if (cf.asOrganization && HOSTING_ORG.test(cf.asOrganization)) return true;

  return false;
}

// Reduce an external referrer URL to a bare hostname (no www). Returns null for
// empty referrers and for our own domains (those are internal navigations, i.e.
// "direct" as far as traffic sources go).
function refHost(raw) {
  if (!raw) return null;
  try {
    const h = new URL(raw).hostname.replace(/^www\./, '').toLowerCase();
    if (!h || /(^|\.)atillasaadat\.(com|me)$/.test(h)) return null;
    return h.slice(0, 128);
  } catch (e) {
    return null;
  }
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

  // Owner opt-out: a machine that has authenticated to /insights gets a long-
  // lived `notrack` cookie (set by insights.js). Honor it here so my own visits
  // are never recorded. Returns the pixel but stores nothing, and doesn't bother
  // assigning a vid.
  if (/(?:^|;\s*)notrack=1(?:;|$)/.test(cookie)) {
    return new Response(PIXEL, { headers });
  }

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
  const asn = Number.isFinite(cf.asn) ? cf.asn : parseInt(cf.asn, 10);
  const ref = refHost(url.searchParams.get('r'));

  // Download event (?e=dl): a click on a downloadable file link (the CV PDF,
  // papers, ...). Recorded in the separate `downloads` table with the same geo /
  // network attribution as a pageview, so downloads never inflate page-view or
  // dwell metrics. `p` here is the file path that was clicked.
  if (url.searchParams.get('e') === 'dl') {
    try {
      if (env.DB) {
        await env.DB.prepare(
          'INSERT INTO downloads (ts, path, city, region, country, lat, lng, asn, org, ref, vid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
        )
          .bind(
            Date.now(),
            path,
            cf.city || null,
            cf.region || null,
            cf.country || null,
            Number.isFinite(lat) ? lat : null,
            Number.isFinite(lng) ? lng : null,
            Number.isFinite(asn) ? asn : null,
            cf.asOrganization || null,
            ref,
            vid,
          )
          .run();
      }
    } catch (e) {
      // ignore: a failed analytics write must not affect the visitor
    }
    return new Response(PIXEL, { headers });
  }

  // Optional ?source= tag from the landing link (e.g. ?source=CV). Visitor-
  // supplied, so strip to a sane charset, trim, and cap length.
  const source =
    (url.searchParams.get('s') || '').replace(/[^\w .\-/]+/g, '').trim().slice(0, 64) || null;
  // Per-pageview id (?i=) that the later dwell-time beacon uses to update this
  // exact row with how long the visitor stayed.
  const pvid = (url.searchParams.get('i') || '').replace(/[^a-zA-Z0-9-]+/g, '').slice(0, 64) || null;

  try {
    if (env.DB) {
      await env.DB.prepare(
        'INSERT INTO pageviews (ts, path, city, region, country, lat, lng, asn, org, ref, source, pvid, vid) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      )
        .bind(
          Date.now(),
          path,
          cf.city || null,
          cf.region || null,
          cf.country || null,
          Number.isFinite(lat) ? lat : null,
          Number.isFinite(lng) ? lng : null,
          Number.isFinite(asn) ? asn : null,
          cf.asOrganization || null,
          ref,
          source,
          pvid,
          vid,
        )
        .run();
    }
  } catch (e) {
    // ignore: a failed analytics write must not affect the visitor
  }

  return new Response(PIXEL, { headers });
}

// Dwell-time report (sent via navigator.sendBeacon, which POSTs). The client
// reports cumulative active time on a page keyed by its per-pageview id (?i=);
// we store the largest value seen for that row. Matched on the visitor cookie
// too, so one visitor can't write another's pageview. Best-effort: any failure
// is swallowed so it never affects the visitor.
export async function onRequestPost({ request, env }) {
  const url = new URL(request.url);
  try {
    const cookie = request.headers.get('Cookie') || '';
    // Owner opt-out machines never inserted a row, so there's nothing to update.
    if (/(?:^|;\s*)notrack=1(?:;|$)/.test(cookie)) {
      return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
    }
    const pvid = (url.searchParams.get('i') || '').replace(/[^a-zA-Z0-9-]+/g, '').slice(0, 64);
    let dur = parseInt(url.searchParams.get('d'), 10);
    if (env.DB && pvid && Number.isFinite(dur) && dur > 0) {
      if (dur > 7200000) dur = 7200000; // cap at 2h; ignore absurd values
      const vid = (cookie.match(/(?:^|;\s*)vid=([^;]+)/) || [])[1] || null;
      if (vid) {
        await env.DB.prepare(
          'UPDATE pageviews SET dur = ? WHERE pvid = ? AND vid = ? AND (dur IS NULL OR dur < ?)',
        )
          .bind(dur, pvid, vid, dur)
          .run();
      }
    }
  } catch (e) {
    // ignore: analytics must never surface an error to the client
  }
  return new Response(null, { status: 204, headers: { 'Cache-Control': 'no-store' } });
}
