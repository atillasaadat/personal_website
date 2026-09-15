import type { Page, TestInfo } from '@playwright/test';

// Pages that should render correctly on every device. Covers the homepage plus
// posts with the trickiest layouts: a gallery, data tables, and slide embeds.
export const PAGES = [
  { path: '/', name: 'home' },
  { path: '/cv', name: 'cv' },
  { path: '/research', name: 'research' },
  { path: '/about', name: 'about' },
  { path: '/post/gnc-engineer-varda-space', name: 'post-varda' },
  { path: '/post/masc-thesis-ch-1-adcs-testing-optimizations', name: 'post-gallery' },
  { path: '/post/mit-storm-ai-challenge', name: 'post-tables' },
  { path: '/post/cryoroute-globally-optimized-naval-routes-in-north-arctic-ocean', name: 'post-slides' },
];

// Block heavy third-party embeds (YouTube, LinkedIn, Cesium, Google Slides, ...)
// so tests are fast and deterministic. The <iframe> elements still occupy their
// CSS-defined size, so layout/overflow checks remain valid.
export async function blockExternals(page: Page) {
  await page.route('**/*', (route) => {
    let host = '';
    try {
      host = new URL(route.request().url()).host;
    } catch {
      /* ignore */
    }
    const isLocal = host === '' || host.startsWith('localhost') || host.startsWith('127.0.0.1');
    if (isLocal) route.continue();
    else route.abort();
  });
}

// After navigation: hide the animated starfield and freeze animations so any
// captured screenshots are stable, and wait for webfonts before measuring.
export async function prep(page: Page) {
  await page.addStyleTag({
    content: `
      #starfield { display: none !important; }
      *, *::before, *::after {
        animation: none !important;
        transition: none !important;
        scroll-behavior: auto !important;
      }
    `,
  });
  await page.evaluate(() => (document as any).fonts?.ready).catch(() => {});
}

// Attach a page screenshot to the HTML report.
//
// Prefers a full-page shot, but falls back to the viewport when the scaled
// image would exceed the 32767px per-dimension limit browsers enforce: the
// WebKit phone projects render at devicePixelRatio 3, which puts a long page
// (the homepage) over the cap and turns a passing test into a screenshot error.
export async function attachShot(page: Page, testInfo: TestInfo, name: string) {
  const { height, dpr } = await page.evaluate(() => ({
    height: document.documentElement.scrollHeight,
    dpr: window.devicePixelRatio,
  }));
  const fullPage = height * dpr < 32000;
  await testInfo.attach(name, {
    body: await page.screenshot({ fullPage }),
    contentType: 'image/png',
  });
}
