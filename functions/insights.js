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
const CONSUMER_ISP = /comcast|xfinity|verizon|at&?t|t-?mobile|sprint|spectrum|charter|cox communic|centurylink|lumen|frontier|optimum|altice|cablevision|telus|rogers|bell canada|shaw|videotron|cogeco|vodafone|orange|telefonica|movistar|deutsche telekom|\btelekom\b|telstra|optus|tpg|sky\b|virgin media|bt group|british telecom|talktalk|plusnet|jio|airtel|bsnl|reliance|china telecom|china unicom|china mobile|chinanet|kddi|\bntt\b|softbank|biglobe|sk broadband|korea telecom|lg uplus|starhub|singtel|maxis|telekom malaysia|pldt|globe telecom|claro|vivo|tim\b|net virtua|telmex|izzi|megacable|free sas|sfr|bouygues|proximus|telenet|kpn|ziggo|swisscom|sunrise|magenta|a1 telekom|telia|telenor|tele2|elisa|dna oyj|spark\b|vocus|starlink|hughesnet|viasat|cellular|wireless|broadband|telecom|telecomunica|t[ée]l[ée]com|cable|fibernet|fiber\b|fibre|\bisp\b|internet service|communications/i;

// Hosting / VPS / cloud networks: automated traffic, also de-emphasized. (The
// beacon already drops most of these; the big clouds are kept and land here.)
const HOSTING_ORG = /amazon|aws\b|google|\bgcp\b|microsoft|azure|oracle|\bibm\b|digitalocean|ovh|hetzner|linode|akamai|fastly|cloudflare|vultr|contabo|scaleway|leaseweb|\bm247\b|choopa|psychz|hostwinds|datacamp|colocrossing|quadranet|hostinger|namecheap|godaddy|bluehost|dreamhost|ionos|alibaba|tencent|huawei cloud|data ?cent(er|re)|dedicated server|virtual server|\bvps\b|colocation|cloud|hosting|server/i;

// Classify a network org so the dashboard can surface likely employer /
// institution visits and dim consumer/hosting noise.
function classifyOrg(org) {
  const o = (org || '').toLowerCase();
  if (!o) return 'unknown';
  if (/universit|college|\binstitut|\.edu\b|\beduc|\bschool\b|academ|polytechnic|\bcnrs\b|max[- ]planck|fraunhofer|govern|\.gov\b|\bnasa\b|\besa\b|jpl\b|national lab|laborator|research (council|center|centre|institute)|\bcern\b|hospital|\bnhs\b|\bmil\b|defen[cs]e|\barmy\b|\bnavy\b|air force/.test(o))
    return 'institution';
  if (CONSUMER_ISP.test(o)) return 'isp';
  if (HOSTING_ORG.test(o)) return 'hosting';
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

function page({ range, fromStr, toStr, label, totals, geo, topPages, countries, regions, cities, orgs, refs }) {
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

  // Choropleth values keyed by ISO-2 country code.
  const mapCountries = {};
  let maxVisitors = 0;
  for (const c of countries) {
    if (!c.country) continue;
    mapCountries[c.country] = { v: c.visitors, w: c.views };
    if (c.visitors > maxVisitors) maxVisitors = c.visitors;
  }

  // Marker layers for finer levels; each needs coordinates from Cloudflare geo.
  const toMarkers = (rows, nameOf) =>
    rows
      .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng))
      .map((r) => ({ name: nameOf(r), coords: [r.lat, r.lng], v: r.visitors, w: r.views }));

  const mapData = {
    countries: mapCountries,
    regions: toMarkers(regions, (r) => [r.region, r.country].filter(Boolean).join(', ')),
    cities: toMarkers(cities, (r) => [r.city, r.region, r.country].filter(Boolean).join(', ')),
  };

  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>Insights &middot; atillasaadat.com</title>
<link rel="icon" href="/favicon.svg" type="image/svg+xml" />
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/jsvectormap@1.5.3/dist/css/jsvectormap.min.css" />
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
  #map { width:100%; height:520px; background:rgba(16,26,46,0.4);
         border:1px solid rgba(126,168,255,0.16); border-radius:10px; }
  .legend { display:flex; align-items:center; gap:0.6rem; margin-top:0.6rem; font-size:0.74rem; color:#aab8d4; }
  .legend .bar { width:160px; height:10px; border-radius:5px;
                 background:linear-gradient(90deg,#1b3a5b,#5eead4); }
  .grid2 { display:grid; grid-template-columns:1fr 1fr; gap:1.5rem; align-items:start; }
  table { width:100%; border-collapse:collapse; font-size:0.88rem; }
  th, td { text-align:left; padding:0.5rem 0.7rem; border-bottom:1px solid rgba(126,168,255,0.12); }
  th { color:#aab8d4; font-weight:600; font-size:0.74rem; text-transform:uppercase; letter-spacing:0.06em; }
  td.num, th.num { text-align:right; font-variant-numeric:tabular-nums; }
  td a { color:#7ea8ff; text-decoration:none; }
  td a:hover { color:#5eead4; }
  .muted { color:#7f8db0; }
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
  .jvm-tooltip { background:#0c1322 !important; border:1px solid #5eead4 !important;
                 color:#e8eef9 !important; border-radius:6px !important; }
  .jvm-zoom-btn { background:#16243f !important; color:#e8eef9 !important; border-radius:5px; }
  @media (max-width:680px){ .cards{ grid-template-columns:repeat(2,1fr); } .grid2{ grid-template-columns:1fr; } }
  @media (max-width:560px){ .daterange{ margin-left:0; } }
</style>
</head><body><div class="wrap">
  <h1>Visitor Insights</h1>
  <p class="sub">atillasaadat.com &middot; ${esc(label)} &middot; times in UTC</p>
  <div class="controls">
    <div class="tabs">${tabs}</div>
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
    <span id="legend-choro" hidden><span>Fewer</span> <span class="bar"></span> <span>More visitors</span></span>
    <span id="legend-marker">Countries are shaded by visitors; each dot is one location, sized by visitors.</span>
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
<script>window.__MAP__ = ${JSON.stringify(mapData)};</script>
<script src="https://cdn.jsdelivr.net/npm/jsvectormap@1.5.3/dist/js/jsvectormap.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/jsvectormap@1.5.3/dist/maps/world.js"></script>
<script>
  (function () {
    var DATA = window.__MAP__ || { countries: {}, regions: [], cities: [] };
    var el = document.getElementById('map');
    var map = null;
    var level = 'cities';

    // Country choropleth values, reused under every marker level so the shaded
    // countries stay visible while dots add finer detail on top.
    var countryValues = {};
    var maxCountry = 0;
    for (var k in DATA.countries) {
      countryValues[k] = DATA.countries[k].v;
      if (DATA.countries[k].v > maxCountry) maxCountry = DATA.countries[k].v;
    }

    // Scale marker radius (4..16px) by visitor count within the current layer.
    function markerLayer(rows) {
      var max = 1;
      for (var i = 0; i < rows.length; i++) if (rows[i].v > max) max = rows[i].v;
      return rows.map(function (r) {
        var radius = 4 + Math.round(12 * Math.sqrt(r.v / max));
        return { name: r.name, coords: r.coords, v: r.v, w: r.w, style: { r: radius } };
      });
    }

    function build(lvl) {
      if (map) { try { map.destroy(); } catch (e) {} map = null; }
      el.innerHTML = '';

      var opts = {
        selector: '#map',
        map: 'world',
        zoomButtons: true,
        zoomOnScroll: true,
        backgroundColor: 'transparent',
        regionStyle: {
          initial: { fill: '#16243f', stroke: '#0a101e', strokeWidth: 0.4 },
          hover: { fill: '#7ea8ff' },
        },
        series: { regions: [{
          attribute: 'fill',
          scale: ['#1b3a5b', '#5eead4'],
          normalizeFunction: 'polynomial',
          values: countryValues,
        }] },
        onRegionTooltipShow: function (event, tooltip, code) {
          var d = DATA.countries[code];
          if (d) tooltip.text(tooltip.text() + ': ' + d.v + ' visitors, ' + d.w + ' views', true);
        },
      };

      if (lvl !== 'countries') {
        var markers = markerLayer(DATA[lvl] || []);
        opts.markers = markers;
        opts.markerStyle = {
          initial: { fill: '#5eead4', stroke: '#05221f', strokeWidth: 1.2, fillOpacity: 0.82 },
          hover: { fill: '#a7f3e4', stroke: '#05221f' },
        };
        opts.onMarkerTooltipShow = function (event, tooltip, index) {
          var m = markers[index];
          if (m) tooltip.text(m.name + ': ' + m.v + ' visitors, ' + m.w + ' views', true);
        };
      }

      map = new jsVectorMap(opts);
    }

    function setLevel(lvl) {
      level = lvl;
      var btns = document.querySelectorAll('.lvl');
      for (var i = 0; i < btns.length; i++)
        btns[i].classList.toggle('active', btns[i].getAttribute('data-level') === lvl);
      document.getElementById('legend-choro').hidden = lvl !== 'countries';
      document.getElementById('legend-marker').hidden = lvl === 'countries';
      var peak = document.getElementById('legend-peak');
      if (lvl === 'countries') peak.textContent = 'Peak: ' + maxCountry + ' visitors in one country';
      else { var n = (DATA[lvl] || []).length; peak.textContent = n + ' located ' + (n === 1 ? lvl.slice(0, -1) : lvl); }
      try { build(lvl); } catch (e) {
        el.innerHTML = '<p style="padding:1rem;color:#aab8d4">Map could not load.</p>';
      }
    }

    var btns = document.querySelectorAll('.lvl');
    for (var i = 0; i < btns.length; i++)
      btns[i].addEventListener('click', function () { setLevel(this.getAttribute('data-level')); });

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
  const render = (totals, geo, topPages, countries, regions, cities, orgs, refs) =>
    new Response(
      page({ range, fromStr, toStr, label, totals, geo, topPages, countries, regions, cities, orgs, refs }),
      { headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' } },
    );

  if (!db) return render(empty, [], [], [], [], [], [], []);

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

    const countries = await db
      .prepare(
        `SELECT country, COUNT(*) AS views, COUNT(DISTINCT vid) AS visitors
         FROM pageviews WHERE ts >= ? AND ts < ? AND country IS NOT NULL AND country != ''
         GROUP BY country ORDER BY visitors DESC`,
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

    // Marker layers: one point per region / city, placed at the average
    // Cloudflare-reported coordinate for that place.
    const regions = await db
      .prepare(
        `SELECT region, country, AVG(lat) AS lat, AVG(lng) AS lng,
                COUNT(*) AS views, COUNT(DISTINCT vid) AS visitors
         FROM pageviews
         WHERE ts >= ? AND ts < ? AND lat IS NOT NULL AND region IS NOT NULL AND region != ''
         GROUP BY country, region ORDER BY visitors DESC LIMIT 500`,
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

    return render(
      totals,
      geo.results || [],
      pages.results || [],
      countries.results || [],
      regions.results || [],
      cities.results || [],
      orgs,
      refs,
    );
  } catch (e) {
    // most likely: schema.sql not applied yet (no such table: pageviews)
    return render(empty, [], [], [], [], [], [], []);
  }
}
