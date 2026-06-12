// Private visitor-analytics dashboard at /insights.
// Protected by HTTP Basic Auth using the ADMIN_PASSWORD environment variable
// (username is "admin"). Renders a filterable table of visits by location.

const RANGES = [
  ['today', 'Today'],
  ['yesterday', 'Yesterday'],
  ['7d', 'Last 7 days'],
  ['30d', 'Last 30 days'],
  ['1y', 'Last year'],
  ['all', 'All time'],
];

function rangeBounds(key) {
  const now = Date.now();
  const DAY = 86400000;
  const startOfToday = Date.UTC(
    new Date(now).getUTCFullYear(),
    new Date(now).getUTCMonth(),
    new Date(now).getUTCDate(),
  );
  switch (key) {
    case 'today':
      return [startOfToday, now];
    case 'yesterday':
      return [startOfToday - DAY, startOfToday];
    case '7d':
      return [now - 7 * DAY, now];
    case '30d':
      return [now - 30 * DAY, now];
    case '1y':
      return [now - 365 * DAY, now];
    case 'all':
    default:
      return [0, now + 1];
  }
}

function esc(v) {
  return String(v ?? '').replace(/[&<>"]/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c],
  );
}

function page(range, totals, geo, topPages) {
  const tabs = RANGES.map(
    ([key, label]) =>
      `<a class="tab${key === range ? ' active' : ''}" href="?range=${key}">${label}</a>`,
  ).join('');

  const geoRows = geo.length
    ? geo
        .map(
          (r) => `<tr>
            <td>${esc(r.country || '—')}</td>
            <td>${esc(r.region || '—')}</td>
            <td>${esc(r.city || '—')}</td>
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

  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="robots" content="noindex, nofollow" />
<title>Insights</title>
<style>
  :root { color-scheme: dark; }
  body { margin:0; background:#05080f; color:#e8eef9; font:15px/1.5 ui-sans-serif,system-ui,sans-serif; }
  .wrap { max-width:960px; margin:0 auto; padding:2rem 1.25rem 4rem; }
  h1 { font-size:1.4rem; margin:0 0 0.25rem; }
  .sub { color:#6f7fa0; font-size:0.85rem; margin:0 0 1.5rem; }
  .tabs { display:flex; flex-wrap:wrap; gap:0.5rem; margin-bottom:1.5rem; }
  .tab { padding:0.4rem 0.9rem; border:1px solid rgba(126,168,255,0.2); border-radius:999px;
         color:#aab8d4; text-decoration:none; font-size:0.82rem; }
  .tab:hover { border-color:#5eead4; color:#5eead4; }
  .tab.active { background:rgba(94,234,212,0.14); border-color:#5eead4; color:#5eead4; }
  .cards { display:grid; grid-template-columns:repeat(3,1fr); gap:1rem; margin-bottom:2rem; }
  .card { background:rgba(16,26,46,0.6); border:1px solid rgba(126,168,255,0.16); border-radius:10px; padding:1.1rem 1.25rem; }
  .card .n { font-size:1.9rem; font-weight:700; font-variant-numeric:tabular-nums; }
  .card .l { color:#6f7fa0; font-size:0.78rem; text-transform:uppercase; letter-spacing:0.08em; }
  h2 { font-size:1rem; margin:1.5rem 0 0.6rem; color:#aab8d4; }
  table { width:100%; border-collapse:collapse; font-size:0.88rem; }
  th, td { text-align:left; padding:0.5rem 0.7rem; border-bottom:1px solid rgba(126,168,255,0.12); }
  th { color:#6f7fa0; font-weight:600; font-size:0.74rem; text-transform:uppercase; letter-spacing:0.06em; }
  td.num, th.num { text-align:right; font-variant-numeric:tabular-nums; }
  .empty { color:#6f7fa0; text-align:center; padding:1.25rem; }
  @media (max-width:560px){ .cards{ grid-template-columns:1fr; } }
</style>
</head><body><div class="wrap">
  <h1>Visitor Insights</h1>
  <p class="sub">atillasaadat.me &middot; times in UTC</p>
  <div class="tabs">${tabs}</div>
  <div class="cards">
    <div class="card"><div class="n">${totals.visitors}</div><div class="l">Unique visitors</div></div>
    <div class="card"><div class="n">${totals.views}</div><div class="l">Page views</div></div>
    <div class="card"><div class="n">${totals.pages}</div><div class="l">Unique pages</div></div>
  </div>
  <h2>By location</h2>
  <table>
    <thead><tr><th>Country</th><th>Region</th><th>City</th><th class="num">Visitors</th><th class="num">Views</th></tr></thead>
    <tbody>${geoRows}</tbody>
  </table>
  <h2>Top pages</h2>
  <table>
    <thead><tr><th>Path</th><th class="num">Visitors</th><th class="num">Views</th></tr></thead>
    <tbody>${pageRows}</tbody>
  </table>
</div></body></html>`;
}

export async function onRequestGet({ request, env }) {
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

  const url = new URL(request.url);
  let range = url.searchParams.get('range') || '7d';
  if (!RANGES.some(([k]) => k === range)) range = '7d';
  const [start, end] = rangeBounds(range);

  const db = env.DB;
  const empty = { visitors: 0, views: 0, pages: 0 };
  if (!db) {
    return new Response(page(range, empty, [], []), {
      headers: { 'Content-Type': 'text/html; charset=utf-8' },
    });
  }

  const totals =
    (await db
      .prepare(
        'SELECT COUNT(*) AS views, COUNT(DISTINCT vid) AS visitors, COUNT(DISTINCT path) AS pages FROM pageviews WHERE ts >= ? AND ts < ?',
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

  const pages = await db
    .prepare(
      `SELECT path, COUNT(*) AS views, COUNT(DISTINCT vid) AS visitors
       FROM pageviews WHERE ts >= ? AND ts < ?
       GROUP BY path ORDER BY views DESC LIMIT 100`,
    )
    .bind(start, end)
    .all();

  return new Response(page(range, totals, geo.results || [], pages.results || []), {
    headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
  });
}
