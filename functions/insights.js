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

function startOfTodayUTC() {
  const n = new Date();
  return Date.UTC(n.getUTCFullYear(), n.getUTCMonth(), n.getUTCDate());
}

function rangeBounds(key) {
  const now = Date.now();
  const sot = startOfTodayUTC();
  switch (key) {
    case 'today': return [sot, now];
    case 'yesterday': return [sot - DAY, sot];
    case '7d': return [now - 7 * DAY, now];
    case '30d': return [now - 30 * DAY, now];
    case '1y': return [now - 365 * DAY, now];
    case 'all': default: return [0, now + 1];
  }
}

// Parse a YYYY-MM-DD string to a UTC midnight timestamp, or null.
function parseDay(s) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s || '')) return null;
  const t = Date.parse(s + 'T00:00:00Z');
  return Number.isFinite(t) ? t : null;
}

function ymd(ts) {
  return new Date(ts).toISOString().slice(0, 10);
}

function esc(v) {
  return String(v ?? '').replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c],
  );
}

function page({ range, fromStr, toStr, label, totals, geo, topPages, countries, regions, cities, orgs, refs, sources }) {
  const today = ymd(Date.now());

  const tabs = RANGES.map(
    ([key, lbl]) =>
      `<a class="tab${key === range ? ' active' : ''}" href="?range=${key}">${lbl}</a>`,
  ).join('');

  const geoRows = geo.length
    ? geo
        .map(
          (r) => `<tr>
            <td>${esc(r.country || '?')}</td>
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
          (r) => `<tr><td>${esc(r.path)}</td><td class="num">${r.visitors}</td><td class="num">${r.views}</td></tr>`,
        )
        .join('')
    : '<tr><td colspan="3" class="empty">No data.</td></tr>';

  // Annotate each org with its classification, then split into the "notable"
  // set (likely employers / institutions) and the full network list.
  const orgRows = orgs.map((r) => ({ ...r, kind: classifyOrg(r.org) }));
  const notable = orgRows.filter((r) => r.kind === 'company' || r.kind === 'institution');

  const orgCell = (r) =>
    `<td><span class="tag ${r.kind}">${ORG_TYPE_LABEL[r.kind]}</span>${esc(r.org)}</td>`;

  const notableRows = notable.length
    ? notable
        .map(
          (r) => `<tr>${orgCell(r)}<td>${esc(r.country || '?')}</td><td class="num">${r.visitors}</td><td class="num">${r.views}</td></tr>`,
        )
        .join('')
    : '<tr><td colspan="4" class="empty">No company or institution networks in this range. (Consumer ISPs and hosting traffic are listed under All networks below.)</td></tr>';

  const allOrgRows = orgRows.length
    ? orgRows
        .map(
          (r) => `<tr class="${r.kind}">${orgCell(r)}<td>${esc(r.country || '?')}</td><td class="num">${r.visitors}</td><td class="num">${r.views}</td></tr>`,
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
  .cards { display:grid; grid-template-columns:repeat(4,1fr); gap:1rem; margin-bottom:2rem; }
  .card { background:rgba(16,26,46,0.6); border:1px solid rgba(126,168,255,0.16); border-radius:10px; padding:1.1rem 1.25rem; }
  .card .n { font-size:1.7rem; font-weight:700; font-variant-numeric:tabular-nums; }
  .card .l { color:#aab8d4; font-size:0.72rem; text-transform:uppercase; letter-spacing:0.07em; }
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
  <p class="sub">atillasaadat.com &middot; ${esc(label)} &middot; times in UTC</p>
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
    <div class="card"><div class="n">${totals.visitors}</div><div class="l">Unique visitors</div></div>
    <div class="card"><div class="n">${totals.views}</div><div class="l">Page views</div></div>
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
        <thead><tr><th>Path</th><th class="num">Visitors</th><th class="num">Views</th></tr></thead>
        <tbody>${pageRows}</tbody>
      </table>
    </div>
  </div>

  <h2>Link sources <span class="hint">from <code>?source=</code> tags you add to your links (CV, business card, ...)</span></h2>
  <table>
    <thead><tr><th>Source tag</th><th class="num">Visitors</th><th class="num">Views</th></tr></thead>
    <tbody>${sourceRows}</tbody>
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

// Basic-auth gate shared by the dashboard (GET) and the clear-data action
// (POST). Returns a Response to short-circuit, or null when authorized.
function authGate(request, env) {
  if (!env.ADMIN_PASSWORD) {
    return new Response('Set the ADMIN_PASSWORD environment variable to enable /insights.', {
      status: 500,
    });
  }
  const auth = request.headers.get('Authorization') || '';
  const expected = 'Basic ' + btoa('admin:' + env.ADMIN_PASSWORD);
  if (auth !== expected) {
    return new Response('Authentication required.', {
      status: 401,
      headers: { 'WWW-Authenticate': 'Basic realm="insights", charset="UTF-8"' },
    });
  }
  return null;
}

// POST /insights with action=clear wipes all recorded visits. Behind the same
// Basic Auth as the dashboard; the UI also requires an explicit confirmation.
export async function onRequestPost({ request, env }) {
  const gate = authGate(request, env);
  if (gate) return gate;

  const form = await request.formData().catch(() => null);
  if (!form || form.get('action') !== 'clear') {
    return new Response('Bad request.', { status: 400 });
  }

  try {
    if (env.DB) await env.DB.prepare('DELETE FROM pageviews').run();
  } catch (e) {
    // ignore: e.g. table not created yet
  }

  // Redirect back to the dashboard so a refresh shows the now-empty data.
  return new Response(null, { status: 303, headers: { Location: '/insights' } });
}

export async function onRequestGet({ request, env }) {
  const gate = authGate(request, env);
  if (gate) return gate;

  const url = new URL(request.url);

  // Custom date range takes precedence when both from & to are valid.
  const fromTs = parseDay(url.searchParams.get('from'));
  const toTs = parseDay(url.searchParams.get('to'));
  let range, start, end, label, fromStr, toStr;

  if (fromTs !== null && toTs !== null) {
    range = null; // no preset highlighted
    start = Math.min(fromTs, toTs);
    end = Math.max(fromTs, toTs) + DAY; // include the whole "to" day
    fromStr = ymd(start);
    toStr = ymd(end - DAY);
    label = fromStr === toStr ? fromStr : `${fromStr} to ${toStr}`;
  } else {
    range = url.searchParams.get('range') || DEFAULT_RANGE;
    if (!RANGES.some(([k]) => k === range)) range = DEFAULT_RANGE;
    [start, end] = rangeBounds(range);
    fromStr = start === 0 ? '' : ymd(start);
    toStr = ymd(end - 1);
    label = (RANGES.find(([k]) => k === range) || [, ''])[1];
  }

  const db = env.DB;
  const empty = { visitors: 0, views: 0, pages: 0, countries: 0 };
  const render = (totals, geo, topPages, countries, regions, cities, orgs, refs, sources) =>
    new Response(
      page({ range, fromStr, toStr, label, totals, geo, topPages, countries, regions, cities, orgs, refs, sources }),
      { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } },
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
    );
  } catch (e) {
    // most likely: schema.sql not applied yet (no such table: pageviews)
    return render(empty, [], [], [], [], [], [], [], []);
  }
}
