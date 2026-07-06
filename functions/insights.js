// Private visitor-analytics dashboard at /insights.
// Protected by HTTP Basic Auth using the ADMIN_PASSWORD environment variable
// (username is "admin"). Shows totals, a country/city map, traffic sources, and
// the networks/organizations visitors come from (to spot employer / institution
// visits), filterable by preset range or a custom from/to date range.

const DAY = 86400000;

const RANGES = [
  ['today', 'Today'],
  ['yesterday', 'Yesterday'],
  ['7d', 'Last 7 days'],
  ['30d', 'Last 30 days'],
  ['1y', 'Last year'],
  ['all', 'All time'],
];

// Default preset when no range / custom dates are supplied.
const DEFAULT_RANGE = 'today';

// Consumer ISPs / telecoms / mobile carriers: residential traffic, not an
// employer or institution. Used only to de-emphasize rows on the dashboard.
const CONSUMER_ISP = /comcast|xfinity|verizon|at&?t|t-?mobile|sprint|spectrum|charter|cox communic|centurylink|lumen|frontier|optimum|altice|cablevision|telus|rogers|bell canada|shaw|videotron|cogeco|vodafone|orange|telefonica|movistar|deutsche telekom|\btelekom\b|telstra|optus|tpg|sky\b|virgin media|bt group|british telecom|talktalk|plusnet|jio|airtel|bsnl|reliance|china telecom|china unicom|china mobile|chinanet|kddi|\bntt\b|softbank|biglobe|sk broadband|korea telecom|lg uplus|starhub|singtel|maxis|telekom malaysia|pldt|globe telecom|claro|vivo|tim\b|net virtua|telmex|izzi|megacable|free sas|sfr|bouygues|proximus|telenet|kpn|ziggo|swisscom|sunrise|magenta|a1 telekom|telia|telenor|tele2|elisa|dna oyj|spark\b|vocus|starlink|hughesnet|viasat|cellular|wireless|broadband|telecom|telecomunica|t[ée]l[ée]com|cable|fibernet|fiber\b|fibre|\bisp\b|internet service|communications|indosat|ooredoo|hutchison|\bioh\b|smartfren|biznet|axiata|grameenphone|banglalink|etisalat|turkcell|chunghwa|viettel|vinaphone|mobifone|\bdito\b/i;

// Hosting / VPS / cloud networks: automated traffic, also de-emphasized. (The
// beacon already drops most of these; the big clouds are kept and land here.)
const HOSTING_ORG = /amazon|aws\b|google|\bgcp\b|microsoft|azure|oracle|\bibm\b|digitalocean|ovh|hetzner|linode|akamai|fastly|cloudflare|vultr|contabo|scaleway|leaseweb|\bm247\b|choopa|psychz|hostwinds|datacamp|colocrossing|quadranet|hostinger|namecheap|godaddy|bluehost|dreamhost|ionos|alibaba|tencent|huawei cloud|data ?cent(er|re)|dedicated server|virtual server|\bvps\b|colocation|cloud|hosting|server|code200|oxylabs|smartproxy|bright ?data|packethub|oculus networks|hurricane electric|cogent|zayo|arelion|\bproxy\b/i;

// Security / email gateways that fetch shared links to scan them: appliance
// traffic, not a human employer, so treat as hosting noise. (Palo Alto, etc.
// are deliberately excluded since they're also plausible real employers.)
const LINK_SCANNER = /fortinet|forticlient|zscaler|proofpoint|mimecast|barracuda|forcepoint|netskope|menlo security|cisco umbrella/i;

// Classify a network org so the dashboard can surface likely employer /
// institution visits and dim consumer/hosting noise.
function classifyOrg(org) {
  const o = (org || '').toLowerCase();
  if (!o) return 'unknown';
  if (/universit|college|\binstitut|\.edu\b|\beduc|\bschool\b|academ|polytechnic|\bcnrs\b|max[- ]planck|fraunhofer|govern|\.gov\b|\bnasa\b|\besa\b|jpl\b|national lab|laborator|research (council|center|centre|institute)|\bcern\b|hospital|\bnhs\b|\bmil\b|defen[cs]e|\barmy\b|\bnavy\b|air force/.test(o))
    return 'institution';
  if (CONSUMER_ISP.test(o)) return 'isp';
  if (HOSTING_ORG.test(o) || LINK_SCANNER.test(o)) return 'hosting';
  return 'company';
}

const ORG_TYPE_LABEL = {
  institution: 'Institution',
  company: 'Company',
  isp: 'Consumer ISP',
  hosting: 'Hosting/cloud',
  unknown: 'Unknown',
};

// --- Timezone handling -----------------------------------------------------
// Visit timestamps are stored and queried in UTC, but the dashboard shows date
// ranges/labels in the viewer's own timezone (sent as a `tz` cookie by the
// client). Cloudflare Workers ship full ICU, so Intl with `timeZone` works.

// Validate an IANA timezone name; return it if usable, else null.
function validTz(tz) {
  if (!tz || typeof tz !== 'string') return null;
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: tz });
    return tz;
  } catch (e) {
    return null;
  }
}

// Read a named cookie from the request.
function cookieVal(request, name) {
  const m = (request.headers.get('Cookie') || '').match(
    new RegExp('(?:^|;\\s*)' + name + '=([^;]+)'),
  );
  return m ? decodeURIComponent(m[1]) : null;
}

// Wall-clock calendar parts of a UTC instant as seen in `tz`.
function tzParts(utcMs, tz) {
  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: tz, hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit',
  });
  const p = {};
  for (const part of dtf.formatToParts(utcMs)) p[part.type] = part.value;
  return { y: +p.year, m: +p.month, d: +p.day, hh: p.hour === '24' ? 0 : +p.hour, mm: +p.minute, ss: +p.second };
}

// Offset (ms) of `tz` at an instant: the wall clock read as UTC minus actual UTC.
function tzOffsetMs(utcMs, tz) {
  const p = tzParts(utcMs, tz);
  return Date.UTC(p.y, p.m - 1, p.d, p.hh, p.mm, p.ss) - utcMs;
}

// UTC timestamp of local midnight of calendar date y-m-d in `tz`. Two-pass to
// resolve DST; midnight almost never lands on a transition, so this is exact.
function zonedMidnightToUtc(y, m, d, tz) {
  const guess = Date.UTC(y, m - 1, d);
  let utc = guess - tzOffsetMs(guess, tz);
  const refined = guess - tzOffsetMs(utc, tz);
  if (refined !== utc) utc = refined;
  return utc;
}

// Start of "today" (local midnight in tz) as a UTC timestamp.
function startOfToday(tz) {
  const p = tzParts(Date.now(), tz);
  return zonedMidnightToUtc(p.y, p.m, p.d, tz);
}

function rangeBounds(key, tz) {
  const now = Date.now();
  const sot = startOfToday(tz);
  switch (key) {
    case 'today': return [sot, now];
    case 'yesterday': {
      const y = tzParts(sot - DAY / 2, tz); // safely inside yesterday
      return [zonedMidnightToUtc(y.y, y.m, y.d, tz), sot];
    }
    case '7d': return [now - 7 * DAY, now];
    case '30d': return [now - 30 * DAY, now];
    case '1y': return [now - 365 * DAY, now];
    case 'all': default: return [0, now + 1];
  }
}

// Parse a YYYY-MM-DD string to the UTC timestamp of local midnight in `tz`, or null.
function parseDay(s, tz) {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
  if (!m) return null;
  return zonedMidnightToUtc(+m[1], +m[2], +m[3], tz);
}

// Format a UTC timestamp as YYYY-MM-DD as seen in `tz`.
function ymd(ts, tz) {
  const p = tzParts(ts, tz);
  const pad = (n) => String(n).padStart(2, '0');
  return `${p.y}-${pad(p.m)}-${pad(p.d)}`;
}

// Start of the calendar day AFTER a local midnight (its exclusive range end).
function nextZonedMidnight(midnightUtc, tz) {
  const p = tzParts(midnightUtc + Math.round(DAY * 1.5), tz);
  return zonedMidnightToUtc(p.y, p.m, p.d, tz);
}

function esc(v) {
  return String(v ?? '').replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c],
  );
}

// Display a country as "<flag image> <code>" (e.g. a US flag then "US").
// Flag emoji are used instead of images on no platform here because Windows
// browsers don't render flag emoji at all (they show the bare letters), so a
// small PNG from flagcdn keeps it consistent everywhere. Falls back to just the
// code (or "?") for anything that isn't a valid two-letter code.
function countryLabel(cc) {
  const code = String(cc || '').trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(code)) return esc(cc || '?');
  const lc = code.toLowerCase();
  return (
    `<img class="flag" src="https://flagcdn.com/20x15/${lc}.png" ` +
    `srcset="https://flagcdn.com/40x30/${lc}.png 2x" width="20" height="15" ` +
    `alt="" loading="lazy" decoding="async"> ${code}`
  );
}

// Format a millisecond duration as a compact human string, or null if there's
// no usable value (so callers can show a muted placeholder instead).
function fmtDur(ms) {
  const s = Math.round(Number(ms) / 1000);
  if (!Number.isFinite(s) || s <= 0) return null;
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ${String(s % 60).padStart(2, '0')}s`;
  const h = Math.floor(m / 60);
  return `${h}h ${String(m % 60).padStart(2, '0')}m`;
}

// A table cell's worth of formatted duration, with a muted dot when unknown.
function durCell(ms) {
  const d = fmtDur(ms);
  return d ? esc(d) : '<span class="muted">&middot;</span>';
}

// Display just the file name of a download path (e.g. /files/Atilla_Saadat_CV.pdf
// -> Atilla_Saadat_CV.pdf), which is what actually got downloaded.
function fileLabel(p) {
  const s = String(p || '');
  return esc(s.split('/').filter(Boolean).pop() || s || '?');
}

function page({ range, fromStr, toStr, label, tz, totals, geo, topPages, countries, regions, cities, orgs, refs, sources, dwell, pageDur, downloads, downloadTotal }) {
  const today = ymd(Date.now(), tz);

  const tabs = RANGES.map(
    ([key, lbl]) =>
      `<a class="tab${key === range ? ' active' : ''}" href="?range=${key}">${lbl}</a>`,
  ).join('');

  const geoRows = geo.length
    ? geo
        .map(
          (r) => `<tr>
            <td>${countryLabel(r.country)}</td>
            <td>${esc(r.region || '?')}</td>
            <td>${esc(r.city || '?')}</td>
            <td class="num">${r.visitors}</td>
            <td class="num">${r.views}</td>
          </tr>`,
        )
        .join('')
    : '<tr><td colspan="5" class="empty">No visits in this range yet.</td></tr>';

  const pageRows = topPages.length
    ? topPages
        .map(
          (r) => `<tr><td>${esc(r.path)}</td><td class="num">${r.visitors}</td><td class="num">${r.views}</td><td class="num">${durCell(pageDur[r.path])}</td></tr>`,
        )
        .join('')
    : '<tr><td colspan="4" class="empty">No data.</td></tr>';

  // Annotate each org with its classification, then split into the "notable"
  // set (likely employers / institutions) and the full network list.
  const orgRows = orgs.map((r) => ({ ...r, kind: classifyOrg(r.org) }));
  const notable = orgRows.filter((r) => r.kind === 'company' || r.kind === 'institution');

  const orgCell = (r) =>
    `<td><span class="tag ${r.kind}">${ORG_TYPE_LABEL[r.kind]}</span>${esc(r.org)}</td>`;

  const notableRows = notable.length
    ? notable
        .map(
          (r) => `<tr>${orgCell(r)}<td>${countryLabel(r.country)}</td><td class="num">${r.visitors}</td><td class="num">${r.views}</td></tr>`,
        )
        .join('')
    : '<tr><td colspan="4" class="empty">No company or institution networks in this range. (Consumer ISPs and hosting traffic are listed under All networks below.)</td></tr>';

  const allOrgRows = orgRows.length
    ? orgRows
        .map(
          (r) => `<tr class="${r.kind}">${orgCell(r)}<td>${countryLabel(r.country)}</td><td class="num">${r.visitors}</td><td class="num">${r.views}</td></tr>`,
        )
        .join('')
    : '<tr><td colspan="4" class="empty">No network data yet. (Apply the latest migrations.sql, then new visits will be attributed.)</td></tr>';

  const refRows = refs.length
    ? refs
        .map((r) => {
          const src = r.ref
            ? `<a href="https://${esc(r.ref)}" target="_blank" rel="noopener noreferrer">${esc(r.ref)}</a>`
            : '<span class="muted">Direct / none</span>';
          return `<tr><td>${src}</td><td class="num">${r.visitors}</td><td class="num">${r.views}</td></tr>`;
        })
        .join('')
    : '<tr><td colspan="3" class="empty">No referrer data yet.</td></tr>';

  const sourceRows = sources.length
    ? sources
        .map(
          (r) => `<tr><td><span class="tag company">tag</span>${esc(r.source)}</td><td class="num">${r.visitors}</td><td class="num">${r.views}</td></tr>`,
        )
        .join('')
    : '<tr><td colspan="3" class="empty">No tagged-link visits yet. Add <code>?source=NAME</code> to a link (e.g. your CV) to attribute clicks here.</td></tr>';

  const downloadRows = downloads.length
    ? downloads
        .map(
          (r) => `<tr>
            <td>${fileLabel(r.path)}</td>
            <td>${countryLabel(r.country)}</td>
            <td>${esc(r.region || '?')}</td>
            <td>${esc(r.city || '?')}</td>
            <td>${r.org ? esc(r.org) : '<span class="muted">&middot;</span>'}</td>
            <td class="num">${r.downloads}</td>
          </tr>`,
        )
        .join('')
    : '<tr><td colspan="6" class="empty">No file downloads in this range yet.</td></tr>';

  // Country and region levels are choropleths: the client matches these keyed
  // values onto GeoJSON boundary polygons (ISO-2 for countries, ISO-2 + region
  // name for states/provinces) and shades them. Cities stay as point markers,
  // placed at the average Cloudflare-reported coordinate for the city.
  const countryAgg = {};
  for (const r of countries) {
    if (r.country) countryAgg[r.country] = { v: r.visitors, w: r.views };
  }
  const regionAgg = {};
  for (const r of regions) {
    if (r.country && r.region)
      regionAgg[`${r.country}|${String(r.region).toLowerCase()}`] = { v: r.visitors, w: r.views };
  }
  const cityMarkers = cities
    .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng))
    .map((r) => ({
      name: [r.city, r.region, r.country].filter(Boolean).join(', '),
      coords: [r.lat, r.lng],
      v: r.visitors,
      w: r.views,
    }));

  const mapData = { countries: countryAgg, regions: regionAgg, cities: cityMarkers };

  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8" />
<script>
  // Tell the server this browser's timezone via a cookie, so date ranges/labels
  // render in local time. Runs before the body paints; reloads once on first
  // visit (or when the zone changes) so the server can re-render. The reload is
  // guarded on the cookie actually sticking, so blocked cookies can't loop.
  (function () {
    try {
      var tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (!tz) return;
      var m = document.cookie.match(/(?:^|;\\s*)tz=([^;]+)/);
      if (m && decodeURIComponent(m[1]) === tz) return;
      document.cookie = 'tz=' + encodeURIComponent(tz) + '; Path=/insights; Max-Age=31536000; SameSite=Strict; Secure';
      if (/(?:^|;\\s*)tz=/.test(document.cookie)) location.reload();
    } catch (e) {}
  })();
</script>
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>Insights &middot; atillasaadat.com</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"
      integrity="sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=" crossorigin="" />
<style>
  :root { color-scheme: dark; }
  body { margin:0; background:#05080f; color:#e8eef9; font:15px/1.5 ui-sans-serif,system-ui,sans-serif; }
  .wrap { max-width:980px; margin:0 auto; padding:2rem 1.25rem 4rem; }
  h1 { font-size:1.4rem; margin:0 0 0.25rem; }
  .sub { color:#aab8d4; font-size:0.85rem; margin:0 0 1.5rem; }
  .controls { display:flex; flex-wrap:wrap; align-items:center; gap:0.6rem; margin-bottom:1.5rem; }
  .tabs { display:flex; flex-wrap:wrap; gap:0.5rem; }
  .tab { padding:0.4rem 0.9rem; border:1px solid rgba(126,168,255,0.2); border-radius:999px;
         color:#aab8d4; text-decoration:none; font-size:0.82rem; }
  .tab:hover { border-color:#5eead4; color:#5eead4; }
  .tab.active { background:rgba(94,234,212,0.14); border-color:#5eead4; color:#5eead4; }
  .refresh { display:inline-flex; align-items:center; gap:0.4rem; background:rgba(94,234,212,0.1);
             color:#5eead4; border:1px solid rgba(94,234,212,0.4); border-radius:999px;
             padding:0.4rem 0.9rem; font:inherit; font-size:0.82rem; cursor:pointer; }
  .refresh:hover { background:rgba(94,234,212,0.22); border-color:#5eead4; }
  .refresh[disabled] { opacity:0.55; cursor:default; }
  .refresh .ic { display:inline-block; transition:transform .6s; }
  .refresh.busy .ic { animation:spin 0.8s linear infinite; }
  @keyframes spin { to { transform:rotate(360deg); } }
  .refresh-status { font-size:0.78rem; color:#7f8db0; }
  .daterange { display:flex; flex-wrap:wrap; align-items:center; gap:0.5rem;
               margin-left:auto; font-size:0.8rem; color:#aab8d4; }
  .daterange input[type=date] { background:#0c1322; color:#e8eef9; border:1px solid rgba(126,168,255,0.25);
               border-radius:8px; padding:0.35rem 0.5rem; font:inherit; color-scheme:dark; }
  .daterange button { background:rgba(94,234,212,0.14); color:#5eead4; border:1px solid #5eead4;
               border-radius:8px; padding:0.4rem 0.9rem; font:inherit; cursor:pointer; }
  .daterange button:hover { background:rgba(94,234,212,0.25); }
  .cards { display:grid; grid-template-columns:repeat(3,1fr); gap:1rem; margin-bottom:2rem; }
  .card { background:rgba(16,26,46,0.6); border:1px solid rgba(126,168,255,0.16); border-radius:10px; padding:1.1rem 1.25rem; }
  .flag { width:20px; height:15px; vertical-align:-3px; margin-right:0.1rem;
          border-radius:2px; box-shadow:0 0 0 1px rgba(126,168,255,0.18); }
  .card .n { font-size:1.7rem; font-weight:700; font-variant-numeric:tabular-nums; }
  .card .l { color:#aab8d4; font-size:0.72rem; text-transform:uppercase; letter-spacing:0.07em; }
  .card.engaged { border-color:rgba(94,234,212,0.4); background:rgba(94,234,212,0.07); }
  .card.engaged .n { color:#5eead4; }
  .card .l .raw { color:#7f8db0; font-size:0.9em; text-transform:none; letter-spacing:0; opacity:0.8; }
  h2 { font-size:1rem; margin:2rem 0 0.6rem; color:#aab8d4; }
  h2 .hint { text-transform:none; letter-spacing:0; font-size:0.78rem; color:#7f8db0; font-weight:400; }
  .maphead { display:flex; flex-wrap:wrap; align-items:center; gap:0.75rem; }
  .levels { display:flex; gap:0.35rem; margin-left:auto; }
  .lvl { padding:0.3rem 0.75rem; border:1px solid rgba(126,168,255,0.2); border-radius:999px;
         background:transparent; color:#aab8d4; font:inherit; font-size:0.78rem; cursor:pointer; }
  .lvl:hover { border-color:#5eead4; color:#5eead4; }
  .lvl.active { background:rgba(94,234,212,0.14); border-color:#5eead4; color:#5eead4; }
  #map { width:100%; height:520px; background:#0a101e;
         border:1px solid rgba(126,168,255,0.16); border-radius:10px; }
  .legend { display:flex; flex-wrap:wrap; align-items:center; gap:0.6rem; margin-top:0.6rem; font-size:0.74rem; color:#aab8d4; }
  .legend .bar { width:160px; height:10px; border-radius:5px;
                 background:linear-gradient(90deg,#2dd4bf,#facc15,#f43f5e); }
  .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:1.5rem; align-items:start; }
  table { width:100%; border-collapse:collapse; font-size:0.88rem; }
  th, td { text-align:left; padding:0.5rem 0.7rem; border-bottom:1px solid rgba(126,168,255,0.12); }
  th { color:#aab8d4; font-weight:600; font-size:0.74rem; text-transform:uppercase; letter-spacing:0.06em; }
  td.num, th.num { text-align:right; font-variant-numeric:tabular-nums; }
  td a { color:#7ea8ff; text-decoration:none; }
  td a:hover { color:#5eead4; }
  .muted { color:#7f8db0; }
  code { font-family:ui-monospace,SFMono-Regular,Menlo,monospace; font-size:0.88em;
         background:rgba(126,168,255,0.12); padding:0.05em 0.35em; border-radius:4px; }
  .empty { color:#aab8d4; text-align:center; padding:1.25rem; }
  .tag { display:inline-block; font-size:0.62rem; text-transform:uppercase; letter-spacing:0.05em;
         padding:0.08rem 0.4rem; border-radius:5px; margin-right:0.55rem; vertical-align:middle;
         border:1px solid transparent; }
  .tag.institution { color:#c4b5fd; background:rgba(167,139,250,0.14); border-color:rgba(167,139,250,0.4); }
  .tag.company { color:#5eead4; background:rgba(94,234,212,0.14); border-color:rgba(94,234,212,0.4); }
  .tag.isp { color:#94a3b8; background:rgba(148,163,184,0.1); }
  .tag.hosting { color:#fbbf24; background:rgba(251,191,36,0.1); }
  .tag.unknown { color:#7f8db0; background:rgba(127,141,176,0.1); }
  tr.isp td, tr.hosting td, tr.unknown td { color:#9fb0cf; }
  details > summary { cursor:pointer; color:#aab8d4; font-size:0.82rem; margin:0.4rem 0; list-style:none; }
  details > summary::before { content:'\\25B8'; display:inline-block; margin-right:0.4rem; transition:transform .15s; }
  details[open] > summary::before { transform:rotate(90deg); }
  .danger { display:flex; flex-wrap:wrap; align-items:center; gap:1rem; justify-content:space-between;
            margin-top:3rem; padding:1.1rem 1.25rem; border:1px solid rgba(248,113,113,0.35);
            border-radius:10px; background:rgba(248,113,113,0.06); }
  .danger strong { color:#fca5a5; }
  .danger p { margin:0.2rem 0 0; color:#aab8d4; font-size:0.82rem; }
  .danger button { background:rgba(248,113,113,0.14); color:#fca5a5; border:1px solid #f87171;
            border-radius:8px; padding:0.5rem 1.1rem; font:inherit; cursor:pointer; }
  .danger button:hover { background:rgba(248,113,113,0.28); color:#fff; }
  .leaflet-container { background:#0a101e; border:1px solid rgba(126,168,255,0.16); border-radius:10px; font:inherit; }
  .leaflet-tooltip { background:#0c1322 !important; border:1px solid #5eead4 !important;
                     color:#e8eef9 !important; border-radius:6px !important; font-size:0.78rem; box-shadow:none; }
  .leaflet-tooltip-top::before { border-top-color:#5eead4 !important; }
  .leaflet-tooltip-bottom::before { border-bottom-color:#5eead4 !important; }
  .leaflet-bar a { background:#16243f !important; color:#e8eef9 !important; border-color:#0a101e !important; }
  .leaflet-bar a:hover { background:#1d2f50 !important; }
  .leaflet-control-attribution { background:rgba(5,8,15,0.7) !important; color:#7f8db0 !important; }
  .leaflet-control-attribution a { color:#7ea8ff !important; }
  @media (max-width:680px){ .cards{ grid-template-columns:repeat(2,1fr); } .grid2{ grid-template-columns:1fr; } }
  @media (max-width:560px){ .daterange{ margin-left:0; } }
</style>
</head><body><div class="wrap">
  <h1>Visitor Insights</h1>
  <p class="sub">atillasaadat.com &middot; ${esc(label)} &middot; times in ${esc(tz)}</p>
  <div class="controls">
    <div class="tabs">${tabs}</div>
    <button type="button" class="refresh" id="refresh-btn" title="Reload the data without refreshing the whole page"><span class="ic">&#x21bb;</span> Refresh</button>
    <span class="refresh-status" id="refresh-status"></span>
    <form class="daterange" method="get">
      <label>From <input type="date" name="from" value="${esc(fromStr)}" max="${today}" /></label>
      <label>To <input type="date" name="to" value="${esc(toStr)}" max="${today}" /></label>
      <button type="submit">Apply</button>
    </form>
  </div>
  <div class="cards">
    <div class="card"><div class="n">${totals.visitors}</div><div class="l">Unique visitors <span class="raw">raw</span></div></div>
    <div class="card"><div class="n">${totals.views}</div><div class="l">Page views <span class="raw">raw</span></div></div>
    <div class="card engaged" title="Visitors who viewed more than one page or registered active time on a page. Single-page, zero-dwell hits (almost all bots) are excluded."><div class="n">${totals.engagedVisitors ?? 0}</div><div class="l">Engaged visitors</div></div>
    <div class="card engaged" title="Page views from engaged visitors only, with the single-page zero-dwell bot hits removed."><div class="n">${totals.engagedViews ?? 0}</div><div class="l">Engaged views</div></div>
    <div class="card"><div class="n">${fmtDur(dwell.avgVisit) || '&middot;'}</div><div class="l">Avg. time on site</div></div>
    <div class="card"><div class="n">${fmtDur(dwell.avgPage) || '&middot;'}</div><div class="l">Avg. time per page</div></div>
    <div class="card"><div class="n">${downloadTotal.total || 0}</div><div class="l">CV downloads</div></div>
    <div class="card"><div class="n">${notable.length}</div><div class="l">Org / institution networks</div></div>
    <div class="card"><div class="n">${totals.countries}</div><div class="l">Countries</div></div>
  </div>

  <div class="maphead">
    <h2>Visitor map</h2>
    <div class="levels">
      <button type="button" class="lvl" data-level="countries">Country</button>
      <button type="button" class="lvl" data-level="regions">Region</button>
      <button type="button" class="lvl active" data-level="cities">City</button>
    </div>
  </div>
  <div id="map"></div>
  <div class="legend">
    <span>Fewer</span> <span class="bar"></span> <span>More visitors</span>
    <span class="muted">countries &amp; regions shaded by visitors; cities shown as points</span>
    <span style="margin-left:auto" id="legend-peak"></span>
  </div>

  <h2>Possible employers &amp; institutions <span class="hint">networks that aren't consumer ISPs or hosting providers</span></h2>
  <table>
    <thead><tr><th>Organization / network</th><th>Country</th><th class="num">Visitors</th><th class="num">Views</th></tr></thead>
    <tbody>${notableRows}</tbody>
  </table>

  <div class="grid2">
    <div>
      <h2>Traffic sources <span class="hint">where visitors came from</span></h2>
      <table>
        <thead><tr><th>Referrer</th><th class="num">Visitors</th><th class="num">Views</th></tr></thead>
        <tbody>${refRows}</tbody>
      </table>
    </div>
    <div>
      <h2>Top pages</h2>
      <table>
        <thead><tr><th>Path</th><th class="num">Visitors</th><th class="num">Views</th><th class="num">Avg time</th></tr></thead>
        <tbody>${pageRows}</tbody>
      </table>
    </div>
  </div>

  <h2>Link sources <span class="hint">from <code>?source=</code> tags you add to your links (CV, business card, ...)</span></h2>
  <table>
    <thead><tr><th>Source tag</th><th class="num">Visitors</th><th class="num">Views</th></tr></thead>
    <tbody>${sourceRows}</tbody>
  </table>

  <h2>CV &amp; file downloads <span class="hint">${downloadTotal.total || 0} download${(downloadTotal.total || 0) === 1 ? '' : 's'} from ${downloadTotal.visitors || 0} visitor${(downloadTotal.visitors || 0) === 1 ? '' : 's'} &middot; clicks on the CV PDF and other /files documents</span></h2>
  <table>
    <thead><tr><th>File</th><th>Country</th><th>Region</th><th>City</th><th>Organization / network</th><th class="num">Downloads</th></tr></thead>
    <tbody>${downloadRows}</tbody>
  </table>

  <h2>By location</h2>
  <table>
    <thead><tr><th>Country</th><th>Region</th><th>City</th><th class="num">Visitors</th><th class="num">Views</th></tr></thead>
    <tbody>${geoRows}</tbody>
  </table>

  <details>
    <summary>All networks (${orgRows.length}) &mdash; including consumer ISPs &amp; hosting</summary>
    <table>
      <thead><tr><th>Organization / network</th><th>Country</th><th class="num">Visitors</th><th class="num">Views</th></tr></thead>
      <tbody>${allOrgRows}</tbody>
    </table>
  </details>

  <div class="danger">
    <div>
      <strong>Clear all data</strong>
      <p>Permanently deletes every recorded visit across all dates. This cannot be undone.</p>
    </div>
    <form method="post" onsubmit="return confirm('Permanently delete ALL recorded visits? This cannot be undone.');">
      <input type="hidden" name="action" value="clear" />
      <button type="submit">Clear all visits</button>
    </form>
  </div>
</div>
<script type="application/json" id="map-data">${JSON.stringify(mapData).replace(/</g, '\\u003c')}</script>
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"
        integrity="sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=" crossorigin=""></script>
<script>
  (function () {
    var map = null;     // persistent Leaflet instance (survives data refreshes)
    var layer = null;   // current marker layer, swapped on level change / refresh
    var level = 'cities';

    // Map data is shipped in a JSON <script>; read it from the live page on
    // load and from the fetched document on refresh (no eval needed).
    function readMapData(root) {
      var el = (root || document).getElementById('map-data');
      try { return el ? JSON.parse(el.textContent) : {}; } catch (e) { return {}; }
    }
    window.__MAP__ = readMapData(document);

    // Readable teal -> amber -> rose gradient (low to high visitors). Each dot
    // also scales in size, so the value reads even where colors are close.
    var STOPS = [[0, [45, 212, 191]], [0.5, [250, 204, 21]], [1, [244, 63, 94]]];
    function colorFor(t) {
      t = Math.max(0, Math.min(1, t));
      for (var i = 1; i < STOPS.length; i++) {
        if (t <= STOPS[i][0]) {
          var a = STOPS[i - 1], b = STOPS[i], f = (t - a[0]) / (b[0] - a[0]);
          return 'rgb(' + [0, 1, 2].map(function (j) {
            return Math.round(a[1][j] + (b[1][j] - a[1][j]) * f);
          }).join(',') + ')';
        }
      }
      return 'rgb(244,63,94)';
    }

    // Current level's data: cities is an array of points; countries/regions are
    // objects keyed by ISO-2 (or "ISO-2|region name") -> { v, w }.
    function curData() {
      return (window.__MAP__ || {})[level] || (level === 'cities' ? [] : {});
    }

    // GeoJSON boundary sources for the choropleth levels (Natural Earth), fetched
    // once on first use and cached. Countries match on ISO-2; states/provinces
    // match on ISO-2 + region name.
    var GEO = { countries: null, regions: null };
    var GEO_URL = {
      countries: 'https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_110m_admin_0_countries.geojson',
      regions: 'https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_50m_admin_1_states_provinces.geojson',
    };

    function valueFor(lvl, feature, data) {
      var p = feature.properties || {};
      if (lvl === 'countries') {
        var code = p.ISO_A2 && p.ISO_A2 !== '-99' ? p.ISO_A2 : p.ISO_A2_EH;
        return code ? data[code] : null;
      }
      var iso = p.iso_a2;
      if (!iso || iso === '-99') return null;
      var names = [p.name, p.gn_name, p.name_en, p.woe_name, p.postal];
      for (var i = 0; i < names.length; i++) {
        if (!names[i]) continue;
        var d = data[iso + '|' + String(names[i]).toLowerCase()];
        if (d) return d;
      }
      return null;
    }

    function featName(lvl, feature) {
      var p = feature.properties || {};
      return lvl === 'countries' ? (p.ADMIN || p.NAME || p.name || '?') : (p.name || p.gn_name || '?');
    }

    function setLegend(text) {
      var peak = document.getElementById('legend-peak');
      if (peak) peak.textContent = text;
    }

    function ensureMap() {
      if (map) return;
      // preferCanvas keeps thousands of boundary polygons fast.
      map = L.map('map', { worldCopyJump: true, minZoom: 1, maxZoom: 12, preferCanvas: true, attributionControl: true })
        .setView([25, 0], 2);
      var carto = L.tileLayer('https://cartodb-basemaps-{s}.global.ssl.fastly.net/dark_all/{z}/{x}/{y}{r}.png', {
        subdomains: 'abcd', maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
      }).addTo(map);
      // If CARTO ever fails to serve tiles, fall back to OSM so the basemap is
      // never left blank behind the data.
      var fellBack = false;
      carto.on('tileerror', function () {
        if (fellBack) return;
        fellBack = true;
        map.removeLayer(carto);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          subdomains: 'abc', maxZoom: 19,
          attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        }).addTo(map);
      });
    }

    // Cities: one circle marker per location, sized & colored by visitors.
    function renderCities(fit) {
      var data = curData();
      var max = 1;
      for (var i = 0; i < data.length; i++) if (data[i].v > max) max = data[i].v;
      var group = L.layerGroup();
      var pts = [];
      for (var j = 0; j < data.length; j++) {
        var r = data[j];
        if (!r.coords || !isFinite(r.coords[0]) || !isFinite(r.coords[1])) continue;
        var t = Math.sqrt(r.v / max);
        var m = L.circleMarker(r.coords, {
          radius: 5 + Math.round(17 * t),
          color: '#05221f', weight: 1, fillColor: colorFor(t), fillOpacity: 0.82,
        });
        m.bindTooltip(r.name + ': ' + r.v + ' visitors, ' + r.w + ' views', { direction: 'top' });
        group.addLayer(m);
        pts.push(r.coords);
      }
      group.addTo(map);
      layer = group;
      setLegend(pts.length + ' located ' + (pts.length === 1 ? 'city' : 'cities') + ' \\u00b7 peak ' + max + ' visitors');
      if (fit && pts.length) { try { map.fitBounds(pts, { padding: [40, 40], maxZoom: 6 }); } catch (e) {} }
    }

    // Countries / regions: shade boundary polygons by visitor count.
    function drawChoropleth(lvl, fit) {
      var data = curData();
      var max = 1, total = 0;
      for (var k in data) { total++; if (data[k].v > max) max = data[k].v; }
      var matched = [];
      layer = L.geoJSON(GEO[lvl], {
        style: function (f) {
          var d = valueFor(lvl, f, data);
          if (!d) return { color: '#37466a', weight: 0.5, fill: true, fillColor: '#16243f', fillOpacity: 0.1 };
          var t = Math.sqrt(d.v / max);
          return { color: '#cdd9f2', weight: 0.8, fill: true, fillColor: colorFor(t), fillOpacity: 0.72 };
        },
        onEachFeature: function (f, lyr) {
          var d = valueFor(lvl, f, data);
          if (!d) return;
          matched.push(lyr);
          lyr.bindTooltip(featName(lvl, f) + ': ' + d.v + ' visitors, ' + d.w + ' views', { sticky: true });
          lyr.on('mouseover', function () { this.setStyle({ weight: 2, color: '#5eead4' }); if (this.bringToFront) this.bringToFront(); });
          lyr.on('mouseout', function () { if (layer) layer.resetStyle(this); });
        },
      }).addTo(map);
      var noun = lvl === 'countries' ? (total === 1 ? 'country' : 'countries') : (total === 1 ? 'region' : 'regions');
      setLegend(matched.length + ' of ' + total + ' ' + noun + ' mapped \\u00b7 peak ' + max + ' visitors');
      if (fit && matched.length) {
        try { map.fitBounds(L.featureGroup(matched).getBounds(), { padding: [40, 40], maxZoom: 6 }); } catch (e) {}
      }
    }

    // Render the current level. Cities draw immediately; country/region lazily
    // fetch their boundary GeoJSON the first time, then draw.
    function renderMap(fit) {
      if (!window.L) return;
      ensureMap();
      if (layer) { map.removeLayer(layer); layer = null; }

      if (level === 'cities') { renderCities(fit); map.invalidateSize(); return; }
      if (GEO[level]) { drawChoropleth(level, fit); map.invalidateSize(); return; }

      setLegend('Loading boundaries\\u2026');
      var want = level;
      fetch(GEO_URL[want], { cache: 'force-cache' })
        .then(function (res) { if (!res.ok) throw new Error(res.status); return res.json(); })
        .then(function (gj) {
          GEO[want] = gj;
          if (level === want) { drawChoropleth(want, fit); map.invalidateSize(); }
        })
        .catch(function () { if (level === want) setLegend('Could not load boundaries'); });
      map.invalidateSize();
    }

    function setLevel(lvl) {
      level = lvl;
      var btns = document.querySelectorAll('.lvl');
      for (var i = 0; i < btns.length; i++)
        btns[i].classList.toggle('active', btns[i].getAttribute('data-level') === lvl);
      renderMap(true);
    }

    // Bind the level + refresh controls. Re-run after a refresh swaps in fresh
    // DOM nodes so the new buttons are wired up again.
    function bindControls() {
      var btns = document.querySelectorAll('.lvl');
      for (var i = 0; i < btns.length; i++) {
        btns[i].classList.toggle('active', btns[i].getAttribute('data-level') === level);
        btns[i].addEventListener('click', function () { setLevel(this.getAttribute('data-level')); });
      }
      var rb = document.getElementById('refresh-btn');
      if (rb) rb.addEventListener('click', function () { refresh(this); });
    }

    // Reload just the data: fetch the same URL, swap the page content (reusing
    // the live map node so the Leaflet view is preserved), and redraw markers.
    function refresh(btn) {
      if (btn) { btn.disabled = true; btn.classList.add('busy'); }
      fetch(location.href, { credentials: 'same-origin', cache: 'no-store' })
        .then(function (res) { if (!res.ok) throw new Error(res.status); return res.text(); })
        .then(function (html) {
          var doc = new DOMParser().parseFromString(html, 'text/html');
          window.__MAP__ = readMapData(doc);
          var newWrap = doc.querySelector('.wrap');
          var curWrap = document.querySelector('.wrap');
          var liveMap = document.getElementById('map');
          if (newWrap && curWrap && liveMap) {
            var slot = newWrap.querySelector('#map');
            if (slot) slot.replaceWith(liveMap); // keep the live Leaflet instance
            curWrap.replaceWith(newWrap);
            bindControls();
            renderMap(false);
            var st = document.getElementById('refresh-status');
            if (st) st.textContent = 'Updated ' + new Date().toLocaleTimeString();
          }
        })
        .catch(function () {
          var st = document.getElementById('refresh-status');
          if (st) st.textContent = 'Refresh failed';
        })
        .finally(function () {
          var rb = document.getElementById('refresh-btn');
          if (rb) { rb.disabled = false; rb.classList.remove('busy'); }
        });
    }

    bindControls();
    setLevel('cities');
  })();
</script>
</body></html>`;
}

// Defensive headers for every /insights response: this is a private admin page,
// so forbid framing (clickjacking the clear button), MIME sniffing, referrer
// leakage of the URL, and any caching.
const SECURITY_HEADERS = {
  'X-Frame-Options': 'DENY',
  'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer',
  'Cache-Control': 'no-store',
};

// Length-independent only past the length check, but the password length is not
// the secret here; this removes the early-exit timing signal of `===`.
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// True when the request was initiated by another site (a forged cross-site
// submission). Sec-Fetch-Site is sent by all modern browsers and is
// authoritative when present; only a "cross-site" initiator is a forgery
// (same-origin / same-site / none are legitimate, e.g. our own form). For
// older clients lacking Fetch Metadata, fall back to comparing the Origin host
// (ignoring an opaque "null" Origin, which Referrer-Policy can produce on a
// legitimate same-origin POST). Requests with neither header aren't
// browser-driven, so there are no victim credentials to abuse.
function isCrossSite(request) {
  const site = request.headers.get('Sec-Fetch-Site');
  if (site) return site === 'cross-site';
  const origin = request.headers.get('Origin');
  if (origin && origin !== 'null') {
    try {
      return new URL(origin).host !== new URL(request.url).host;
    } catch (e) {
      return true;
    }
  }
  return false;
}

// Basic-auth gate shared by the dashboard (GET) and the clear-data action
// (POST). Returns a Response to short-circuit, or null when authorized.
function authGate(request, env) {
  if (!env.ADMIN_PASSWORD) {
    return new Response('Set the ADMIN_PASSWORD environment variable to enable /insights.', {
      status: 500,
      headers: SECURITY_HEADERS,
    });
  }
  const auth = request.headers.get('Authorization') || '';
  const expected = 'Basic ' + btoa('admin:' + env.ADMIN_PASSWORD);
  if (!safeEqual(auth, expected)) {
    return new Response('Authentication required.', {
      status: 401,
      headers: { ...SECURITY_HEADERS, 'WWW-Authenticate': 'Basic realm="insights", charset="UTF-8"' },
    });
  }
  return null;
}

// POST /insights with action=clear wipes all recorded visits. Behind the same
// Basic Auth as the dashboard; the UI also requires an explicit confirmation.
export async function onRequestPost({ request, env }) {
  // Block cross-site POSTs: cached Basic Auth is auto-resent by the browser, so
  // without this a malicious page could CSRF this destructive action.
  if (isCrossSite(request)) {
    return new Response('Cross-site request blocked.', { status: 403, headers: SECURITY_HEADERS });
  }

  const gate = authGate(request, env);
  if (gate) return gate;

  const form = await request.formData().catch(() => null);
  if (!form || form.get('action') !== 'clear') {
    return new Response('Bad request.', { status: 400, headers: SECURITY_HEADERS });
  }

  try {
    if (env.DB) await env.DB.prepare('DELETE FROM pageviews').run();
  } catch (e) {
    // ignore: e.g. table not created yet
  }
  try {
    if (env.DB) await env.DB.prepare('DELETE FROM downloads').run();
  } catch (e) {
    // ignore: e.g. downloads table not created yet
  }

  // Redirect back to the dashboard so a refresh shows the now-empty data.
  return new Response(null, { status: 303, headers: { ...SECURITY_HEADERS, Location: '/insights' } });
}

export async function onRequestGet({ request, env }) {
  const gate = authGate(request, env);
  if (gate) return gate;

  const url = new URL(request.url);

  // Viewer's timezone (from the `tz` cookie the client sets, or a ?tz= override);
  // ranges and labels are computed in it. Defaults to UTC.
  const tz = validTz(url.searchParams.get('tz')) || validTz(cookieVal(request, 'tz')) || 'UTC';

  // Custom date range takes precedence when both from & to are valid.
  const fromTs = parseDay(url.searchParams.get('from'), tz);
  const toTs = parseDay(url.searchParams.get('to'), tz);
  let range, start, end, label, fromStr, toStr;

  if (fromTs !== null && toTs !== null) {
    range = null; // no preset highlighted
    start = Math.min(fromTs, toTs);
    const lastDay = Math.max(fromTs, toTs);
    end = nextZonedMidnight(lastDay, tz); // exclusive: start of the day after "to"
    fromStr = ymd(start, tz);
    toStr = ymd(lastDay, tz);
    label = fromStr === toStr ? fromStr : `${fromStr} to ${toStr}`;
  } else {
    range = url.searchParams.get('range') || DEFAULT_RANGE;
    if (!RANGES.some(([k]) => k === range)) range = DEFAULT_RANGE;
    [start, end] = rangeBounds(range, tz);
    fromStr = start === 0 ? '' : ymd(start, tz);
    toStr = ymd(end - 1, tz);
    label = (RANGES.find(([k]) => k === range) || [, ''])[1];
  }

  const db = env.DB;

  // Exclude the owner's own machine from analytics. Reaching the (authenticated)
  // dashboard means this is my browser, so: (1) drop a long-lived `notrack`
  // cookie that track.js honors to never record future visits from here, and
  // (2) delete any visits already recorded from this browser, matched by the
  // tracking cookie (vid). This is per-machine/browser, so logging in from a new
  // device/browser opts that one out too.
  const myVid = cookieVal(request, 'vid');
  const OPT_OUT_COOKIE = 'notrack=1; Path=/; Max-Age=34560000; SameSite=Lax; Secure; HttpOnly';
  if (db && myVid) {
    try {
      await db.prepare('DELETE FROM pageviews WHERE vid = ?').bind(myVid).run();
    } catch (e) {
      // ignore: cleanup is best-effort and must not break the dashboard
    }
    try {
      await db.prepare('DELETE FROM downloads WHERE vid = ?').bind(myVid).run();
    } catch (e) {
      // ignore: downloads table may not exist yet; best-effort cleanup
    }
  }

  const empty = { visitors: 0, views: 0, pages: 0, countries: 0 };
  const render = (
    totals, geo, topPages, countries, regions, cities, orgs, refs, sources,
    dwell = { avgVisit: null, avgPage: null }, pageDur = {},
    downloads = [], downloadTotal = { total: 0, visitors: 0 },
  ) =>
    new Response(
      page({ range, fromStr, toStr, label, tz, totals, geo, topPages, countries, regions, cities, orgs, refs, sources, dwell, pageDur, downloads, downloadTotal }),
      {
        headers: {
          ...SECURITY_HEADERS,
          'Content-Type': 'text/html; charset=utf-8',
          'Set-Cookie': OPT_OUT_COOKIE,
        },
      },
    );

  if (!db) return render(empty, [], [], [], [], [], [], [], []);

  try {
    const totals =
      (await db
        .prepare(
          `SELECT COUNT(*) AS views, COUNT(DISTINCT vid) AS visitors,
                  COUNT(DISTINCT path) AS pages,
                  COUNT(DISTINCT CASE WHEN country != '' THEN country END) AS countries
           FROM pageviews WHERE ts >= ? AND ts < ?`,
        )
        .bind(start, end)
        .first()) || empty;

    // "Engaged" totals: the bot clusters that slip past the beacon filter (real
    // Mozilla UA, Accept-Language, Sec-Fetch, residential/business ASN) share a
    // behavioral fingerprint: a fresh cookie every hit, only ever the homepage,
    // and no dwell beacon. So count a visitor as engaged only if they viewed
    // more than one page OR registered active time on some page, and report
    // engaged views/visitors alongside the raw counts. `dur` is a later
    // migration, so degrade silently (cards fall back to the raw feel) if it's
    // absent. Kept next to the raw totals rather than replacing them so the
    // difference is visible.
    try {
      const eng = await db
        .prepare(
          `SELECT COUNT(*) AS visitors, COALESCE(SUM(cnt), 0) AS views FROM (
             SELECT vid, COUNT(*) AS cnt,
                    MAX(CASE WHEN dur IS NOT NULL AND dur > 0 THEN 1 ELSE 0 END) AS dwelled
             FROM pageviews WHERE ts >= ? AND ts < ?
             GROUP BY vid
             HAVING cnt > 1 OR dwelled = 1)`,
        )
        .bind(start, end)
        .first();
      if (eng) {
        totals.engagedVisitors = eng.visitors;
        totals.engagedViews = eng.views;
      }
    } catch (e) {
      // dur column missing: skip the engaged split, leave raw totals only
    }

    const geo = await db
      .prepare(
        `SELECT country, region, city, COUNT(*) AS views, COUNT(DISTINCT vid) AS visitors
         FROM pageviews WHERE ts >= ? AND ts < ?
         GROUP BY country, region, city ORDER BY views DESC LIMIT 500`,
      )
      .bind(start, end)
      .all();

    // Country choropleth values, keyed by ISO-2 country code on the client.
    const countries = await db
      .prepare(
        `SELECT country, COUNT(*) AS views, COUNT(DISTINCT vid) AS visitors
         FROM pageviews
         WHERE ts >= ? AND ts < ? AND country IS NOT NULL AND country != ''
         GROUP BY country ORDER BY visitors DESC LIMIT 300`,
      )
      .bind(start, end)
      .all();

    const pages = await db
      .prepare(
        `SELECT path, COUNT(*) AS views, COUNT(DISTINCT vid) AS visitors
         FROM pageviews WHERE ts >= ? AND ts < ?
         GROUP BY path ORDER BY views DESC LIMIT 100`,
      )
      .bind(start, end)
      .all();

    // Region choropleth values, keyed by "<ISO-2>|<region name>" on the client.
    const regions = await db
      .prepare(
        `SELECT region, country, COUNT(*) AS views, COUNT(DISTINCT vid) AS visitors
         FROM pageviews
         WHERE ts >= ? AND ts < ? AND region IS NOT NULL AND region != ''
         GROUP BY country, region ORDER BY visitors DESC LIMIT 800`,
      )
      .bind(start, end)
      .all();

    const cities = await db
      .prepare(
        `SELECT city, region, country, AVG(lat) AS lat, AVG(lng) AS lng,
                COUNT(*) AS views, COUNT(DISTINCT vid) AS visitors
         FROM pageviews
         WHERE ts >= ? AND ts < ? AND lat IS NOT NULL AND city IS NOT NULL AND city != ''
         GROUP BY country, region, city ORDER BY visitors DESC LIMIT 1000`,
      )
      .bind(start, end)
      .all();

    // Network org & referrer queries reference columns added in a later
    // migration; degrade to empty (rather than blanking the whole dashboard)
    // if migrations.sql hasn't been applied to this database yet.
    let orgs = [];
    let refs = [];
    let sources = [];
    try {
      const o = await db
        .prepare(
          `SELECT org, country, COUNT(*) AS views, COUNT(DISTINCT vid) AS visitors
           FROM pageviews WHERE ts >= ? AND ts < ? AND org IS NOT NULL AND org != ''
           GROUP BY org, country ORDER BY visitors DESC, views DESC LIMIT 300`,
        )
        .bind(start, end)
        .all();
      orgs = o.results || [];
    } catch (e) {
      // org column missing: skip network attribution
    }
    try {
      const r = await db
        .prepare(
          `SELECT ref, COUNT(*) AS views, COUNT(DISTINCT vid) AS visitors
           FROM pageviews WHERE ts >= ? AND ts < ?
           GROUP BY ref ORDER BY (ref IS NULL), visitors DESC, views DESC LIMIT 100`,
        )
        .bind(start, end)
        .all();
      refs = r.results || [];
    } catch (e) {
      // ref column missing: skip traffic sources
    }
    try {
      const s = await db
        .prepare(
          `SELECT source, COUNT(*) AS views, COUNT(DISTINCT vid) AS visitors
           FROM pageviews WHERE ts >= ? AND ts < ? AND source IS NOT NULL AND source != ''
           GROUP BY source ORDER BY visitors DESC, views DESC LIMIT 100`,
        )
        .bind(start, end)
        .all();
      sources = s.results || [];
    } catch (e) {
      // source column missing: skip tagged-link sources
    }

    // Dwell time: avg active time per page, and avg total per visit (sum of a
    // visitor's page durations). Only rows with a recorded duration count.
    // `dur` is a later migration, so degrade to nulls if the column is absent.
    let dwell = { avgVisit: null, avgPage: null };
    let pageDur = {};
    try {
      const p = await db
        .prepare(
          `SELECT AVG(dur) AS avgPage FROM pageviews
           WHERE ts >= ? AND ts < ? AND dur IS NOT NULL AND dur > 0`,
        )
        .bind(start, end)
        .first();
      const v = await db
        .prepare(
          `SELECT AVG(t) AS avgVisit FROM (
             SELECT vid, SUM(dur) AS t FROM pageviews
             WHERE ts >= ? AND ts < ? AND dur IS NOT NULL AND dur > 0
             GROUP BY vid)`,
        )
        .bind(start, end)
        .first();
      dwell = { avgPage: p && p.avgPage, avgVisit: v && v.avgVisit };

      const pd = await db
        .prepare(
          `SELECT path, AVG(dur) AS avgDur FROM pageviews
           WHERE ts >= ? AND ts < ? AND dur IS NOT NULL AND dur > 0
           GROUP BY path`,
        )
        .bind(start, end)
        .all();
      for (const r of pd.results || []) pageDur[r.path] = r.avgDur;
    } catch (e) {
      // dur column missing: skip dwell-time metrics
    }

    // File downloads (CV PDF, papers). Separate table, so degrade to empty if it
    // hasn't been created yet (apply migrations.sql).
    let downloads = [];
    let downloadTotal = { total: 0, visitors: 0 };
    try {
      const dt = await db
        .prepare(
          `SELECT COUNT(*) AS total, COUNT(DISTINCT vid) AS visitors
           FROM downloads WHERE ts >= ? AND ts < ?`,
        )
        .bind(start, end)
        .first();
      if (dt) downloadTotal = dt;
      const d = await db
        .prepare(
          `SELECT path, country, region, city, org,
                  COUNT(*) AS downloads, COUNT(DISTINCT vid) AS visitors
           FROM downloads WHERE ts >= ? AND ts < ?
           GROUP BY path, country, region, city, org
           ORDER BY downloads DESC, visitors DESC LIMIT 500`,
        )
        .bind(start, end)
        .all();
      downloads = d.results || [];
    } catch (e) {
      // downloads table missing: skip download metrics
    }

    return render(
      totals,
      geo.results || [],
      pages.results || [],
      countries.results || [],
      regions.results || [],
      cities.results || [],
      orgs,
      refs,
      sources,
      dwell,
      pageDur,
      downloads,
      downloadTotal,
    );
  } catch (e) {
    // most likely: schema.sql not applied yet (no such table: pageviews)
    return render(empty, [], [], [], [], [], [], [], []);
  }
}
