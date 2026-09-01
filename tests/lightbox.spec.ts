import { test, expect } from '@playwright/test';
import { blockExternals, prep } from './_helpers';

// The site has one image viewer (src/lib/lightbox.ts) shared by post figures,
// post galleries and the AutoGallery on /about and /research. These check the
// contract every caller depends on: images expand, a set can be browsed, and a
// closed viewer gives the page back.

test.beforeEach(async ({ page }) => {
  await blockExternals(page);
});

const lightbox = '#lightbox';
const POST = '/post/gnc-engineer-turion-space';

test('every post image is bound to the shared viewer', async ({ page }) => {
  await page.goto(POST, { waitUntil: 'domcontentloaded' });
  await prep(page);
  await expect(page.locator('.post-body figure img').first()).toBeVisible();

  const unbound = await page.evaluate(() =>
    [...document.querySelectorAll<HTMLImageElement>('.post-body img')]
      .filter((i) => !i.closest('.gallery-thumb') && !i.closest('a') && !i.dataset.lightboxBound)
      .map((i) => i.getAttribute('src')),
  );
  expect(unbound, 'post images with no click-to-expand binding').toEqual([]);
});

test('a standalone post figure expands, then closes and releases the page', async ({ page }) => {
  await page.goto(POST, { waitUntil: 'domcontentloaded' });
  await prep(page);

  await page.locator('.post-body figure.figure-single img').first().click();
  const dlg = page.locator(lightbox);
  await expect(dlg).toBeVisible();
  // A lone image is not a set, so it gets no prev/next.
  await expect(page.locator('.lightbox-next')).toBeHidden();

  await page.keyboard.press('Escape');
  await expect(dlg).toBeHidden();
  // Regression: an author `display` on the bare dialog beats the UA rule that
  // hides a closed one, leaving an invisible overlay swallowing every click.
  await expect(dlg).toHaveCSS('display', 'none');
});

test('a post gallery expands as a browsable set and stays in sync', async ({ page }) => {
  await page.goto('/post/masc-thesis-ch-1-adcs-testing-optimizations', { waitUntil: 'domcontentloaded' });
  await prep(page);

  const stage = page.locator('.post-body .gallery-img');
  await expect(stage).toBeVisible();
  await stage.click();

  await expect(page.locator(lightbox)).toBeVisible();
  await expect(page.locator('.lightbox-next')).toBeVisible();
  await expect(page.locator('.lightbox-hint')).toContainText('1 /');

  await page.locator('.lightbox-next').click();
  await expect(page.locator('.lightbox-hint')).toContainText('2 /');

  // Browsing in the viewer moves the gallery behind it, so closing leaves the
  // reader on the image they were last looking at.
  await page.keyboard.press('Escape');
  await expect(page.locator(lightbox)).toBeHidden();
  await expect(page.locator('.post-body .gallery .gi')).toHaveText('2');
});

test('the /about gallery opens the same viewer', async ({ page }) => {
  await page.goto('/about', { waitUntil: 'domcontentloaded' });
  await prep(page);

  await page.locator('.ag-zoom').click();
  await expect(page.locator(lightbox)).toBeVisible();
  await expect(page.locator('.lightbox-hint')).toContainText('1 /');
  // One viewer for the whole site, never a per-component copy.
  await expect(page.locator(lightbox)).toHaveCount(1);

  await page.keyboard.press('Escape');
  await expect(page.locator(lightbox)).toBeHidden();
});

test('the expanded image and its caption stay inside the viewport', async ({ page }) => {
  await page.goto(POST, { waitUntil: 'domcontentloaded' });
  await prep(page);

  await page.locator('.post-body .gallery-img').click();
  await expect(page.locator(lightbox)).toBeVisible();

  const spill = await page.evaluate(() => {
    const bad: string[] = [];
    for (const sel of ['.lightbox-img', '.lightbox-cap', '.lightbox-hint']) {
      const r = document.querySelector(sel)!.getBoundingClientRect();
      if (r.left < -1 || r.right > innerWidth + 1 || r.top < -1 || r.bottom > innerHeight + 1) {
        bad.push(`${sel} ${JSON.stringify({ l: r.left, r: r.right, t: r.top, b: r.bottom })}`);
      }
    }
    return bad;
  });
  expect(spill, `viewport ${JSON.stringify(page.viewportSize())}`).toEqual([]);
});
