// Minimal oEmbed provider so consumers that prefer oEmbed (over Open Graph)
// still get a rich preview with the page's dynamic card as the thumbnail.
//   GET /oembed?url=<page url>&format=json
// The thumbnail maps to the build-time OG card at /og/<route>.png.

const ORIGIN = 'https://atillasaadat.com';

const TITLES = {
  index: 'Atilla Saadat, Spacecraft GNC Engineer',
  projects: 'Projects, Research & Experience',
  cv: 'Atilla Saadat, CV',
};

function routeFor(pathname) {
  const path = pathname.replace(/\/+$/, '') || '/';
  if (path === '/projects') return 'projects';
  if (path === '/cv') return 'cv';
  if (path.startsWith('/post/')) return 'post/' + path.slice('/post/'.length);
  return 'index';
}

export async function onRequestGet({ request }) {
  const reqUrl = new URL(request.url);
  const target = reqUrl.searchParams.get('url');
  const format = reqUrl.searchParams.get('format') || 'json';

  if (!target) return new Response('Missing url parameter.', { status: 400 });
  if (format !== 'json') return new Response('Only json format is supported.', { status: 501 });

  let pathname;
  try {
    pathname = new URL(target).pathname;
  } catch (e) {
    return new Response('Invalid url parameter.', { status: 400 });
  }

  const route = routeFor(pathname);
  const body = {
    version: '1.0',
    type: 'link',
    title: TITLES[route] || 'Atilla Saadat',
    author_name: 'Atilla Saadat',
    author_url: ORIGIN,
    provider_name: 'Atilla Saadat',
    provider_url: ORIGIN,
    thumbnail_url: `${ORIGIN}/og/${route}.png`,
    thumbnail_width: 1200,
    thumbnail_height: 630,
  };

  return new Response(JSON.stringify(body), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
