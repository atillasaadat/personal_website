import { test, expect } from '@playwright/test';
import { blockExternals, prep, attachShot } from './_helpers';

// Regression tests for the CV page's PDF.js embed.
//
// Background: the viewer is vendored into public/pdfjs/. It used to be PDF.js's
// *default* build, which Mozilla ships untranspiled and unpolyfilled "for the
// latest browsers"; it died on load in iOS WebKit and left a blank box on
// phones while desktop was fine. Nothing in the old suite noticed, because the
// iframe element itself was present and correctly sized -- it was the app
// inside it that never started. So these tests reach *into* the same-origin
// iframe and assert a page was actually painted.

const CV_PDF = '/files/Atilla_Saadat_CV.pdf';

test.beforeEach(async ({ page }) => {
  await blockExternals(page);
});

test('the PDF.js viewer starts and paints a page', async ({ page }) => {
  await page.goto('/cv', { waitUntil: 'domcontentloaded' });
  await prep(page);

  // cv.astro polls the iframe and publishes the outcome here, so this single
  // assertion covers "the viewer app booted and rendered", not just "an iframe
  // exists". 'failed' means the fallback links took over.
  const viewer = page.locator('[data-cv-viewer]');
  await expect(viewer).toHaveAttribute('data-state', 'ok', { timeout: 20_000 });
  await expect(page.locator('.viewer-fallback')).toBeHidden();
});

test('the rendered PDF page fills the embed rather than collapsing', async ({ page }, testInfo) => {
  await page.goto('/cv', { waitUntil: 'domcontentloaded' });
  await prep(page);
  await expect(page.locator('[data-cv-viewer]')).toHaveAttribute('data-state', 'ok', { timeout: 20_000 });

  const frame = page.frameLocator('.viewer iframe');
  const firstPage = frame.locator('#viewer .page').first();
  await expect(firstPage).toBeVisible();

  const iframeBox = (await page.locator('.viewer iframe').boundingBox())!;
  const pageBox = (await firstPage.boundingBox())!;

  // A phone-sized embed still has to be tall enough to read in, and the PDF
  // page has to actually use the width it is given (a collapsed or 1px-wide
  // page is the shape the iOS failure took).
  expect(iframeBox.height, 'the embed is too short to read the CV in').toBeGreaterThan(320);
  expect(pageBox.width, 'the rendered PDF page does not fill the embed').toBeGreaterThan(
    iframeBox.width * 0.5,
  );
  expect(pageBox.height).toBeGreaterThan(200);

  await attachShot(page, testInfo, `cv-${testInfo.project.name}`);
});

test('the viewer loads every subresource it asks for', async ({ page }) => {
  // The vendored viewer is a hand-trimmed copy of the PDF.js dist, so it is
  // easy to leave out a directory it fetches at runtime. That has already
  // happened twice: web/wasm/ (every CV view logged a WebAssembly
  // CompileError) and web/iccs/ (colour profile missing, CMYK fell back).
  // Both only surfaced by chance. Fail the build instead.
  const failures: string[] = [];
  page.on('response', (r) => {
    if (r.status() >= 400) failures.push(`${r.status()} ${r.url()}`);
  });

  await page.goto('/cv', { waitUntil: 'domcontentloaded' });
  await prep(page);
  await expect(page.locator('[data-cv-viewer]')).toHaveAttribute('data-state', 'ok', { timeout: 20_000 });
  await page.waitForTimeout(1000); // let on-demand fetches (wasm, icc) settle

  expect(failures, `the CV page requested resources that 404'd: ${failures.join(', ')}`).toEqual([]);
});

test('the outline sidebar stays closed so it cannot cover the CV', async ({ page }) => {
  // #pagemode=none in the viewer URL. PDF.js opens its outline panel on every
  // load, and below 840px that panel is an overlay, not a column, so it covered
  // half the CV on a phone (and cost eight layout shifts on desktop).
  await page.goto('/cv', { waitUntil: 'domcontentloaded' });
  await prep(page);
  await expect(page.locator('[data-cv-viewer]')).toHaveAttribute('data-state', 'ok', { timeout: 20_000 });

  const outerContainer = page.frameLocator('.viewer iframe').locator('#outerContainer');
  await expect(outerContainer).not.toHaveClass(/sidebarOpen/);
});

test('the download and open links point at the CV PDF', async ({ page }) => {
  await page.goto('/cv', { waitUntil: 'domcontentloaded' });
  await prep(page);

  // The download link is also what the analytics beacon counts as a CV
  // download, and the fallback panel reuses both.
  await expect(page.locator(`.section-head a[href="${CV_PDF}"][download]`)).toBeVisible();
  await expect(page.locator(`.section-head a[href="${CV_PDF}"][target="_blank"]`)).toBeVisible();
  await expect(page.locator(`.viewer-fallback a[href="${CV_PDF}"]`)).toHaveCount(2);
});

test('a viewer that cannot start falls back to plain links', async ({ page }, testInfo) => {
  // The safety net itself. One viewport is enough: it is engine behaviour, not
  // layout, and it has to wait out the give-up timer in cv.astro.
  test.skip(testInfo.project.name !== 'mobile', 'engine behaviour, not layout');
  test.setTimeout(60_000);

  // Simulate the old iOS failure: the viewer's main bundle never arrives, so
  // PDF.js never boots and the iframe stays empty.
  await page.route('**/pdfjs/build/pdf.mjs', (route) => route.abort());
  await page.goto('/cv', { waitUntil: 'domcontentloaded' });
  await prep(page);

  const viewer = page.locator('[data-cv-viewer]');
  await expect(viewer).toHaveAttribute('data-state', 'failed', { timeout: 30_000 });

  // The reader must still end up with a usable CV, not an empty box.
  const fallback = page.locator('.viewer-fallback');
  await expect(fallback).toBeVisible();
  await expect(fallback.locator(`a[href="${CV_PDF}"]`).first()).toBeVisible();
  await expect(page.locator('.viewer iframe')).toBeHidden();
});
