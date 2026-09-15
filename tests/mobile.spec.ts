import { test, expect } from '@playwright/test';
import { PAGES, blockExternals, prep } from './_helpers';

// Small-screen behaviour, run only on the phone and tablet projects.
//
// responsive.spec.ts already covers the *width* failures (sideways scrolling,
// elements spilling past the right edge). This file covers the other way a
// page breaks on a small screen: something that renders on desktop simply is
// not there, has collapsed to nothing, or cannot be reached. The CV embed
// going blank on iOS was exactly that shape, and the suite had no way to see
// it.

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'desktop', 'small-screen behaviour only');
  await blockExternals(page);
});

for (const { path, name } of PAGES) {
  test.describe(name, () => {
    test('no embed, image or video collapses to nothing', async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await prep(page);
      await page.waitForTimeout(600);

      const collapsed = await page.evaluate(() => {
        const shown = (el: Element) =>
          el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
        return Array.from(document.querySelectorAll('iframe, video, img, canvas'))
          .filter((el) => {
            if (!shown(el)) return false;
            const r = el.getBoundingClientRect();
            return r.width < 1 || r.height < 1;
          })
          .map((el) => `${el.tagName}.${el.className} src=${el.getAttribute('src') ?? ''}`);
      });

      expect(collapsed, `media rendered at zero size on ${path}: ${collapsed.join(', ')}`).toEqual([]);
    });

    test('nothing is clipped off the left edge', async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await prep(page);
      await page.waitForTimeout(300);

      // The mirror of responsive.spec.ts's right-edge check. A negative margin
      // or a grid that does not reflow pushes content off the *left* on narrow
      // screens, where it is unreachable: the page cannot scroll that way.
      const offenders = await page.evaluate(() => {
        const inScrollContainer = (el: Element) => {
          let p = el.parentElement;
          while (p && p !== document.body) {
            const ox = getComputedStyle(p).overflowX;
            if (ox === 'auto' || ox === 'scroll' || ox === 'hidden') return true;
            p = p.parentElement;
          }
          return false;
        };
        return Array.from(document.querySelectorAll('img, video, iframe, pre, table, h1, h2, p, li'))
          .filter((el) => !inScrollContainer(el))
          .map((el) => {
            const r = el.getBoundingClientRect();
            return { tag: el.tagName, cls: String((el as HTMLElement).className).slice(0, 40), left: Math.round(r.left), width: Math.round(r.width) };
          })
          .filter((b) => b.width > 0 && b.left < -2);
      });

      expect(offenders, `content is clipped off the left edge on ${path}: ${JSON.stringify(offenders)}`).toEqual([]);
    });

    test('the page heading is readable and not hidden under the sticky header', async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await prep(page);

      const h1 = page.locator('h1').first();
      await expect(h1).toBeVisible();

      // getByRole('banner') rather than 'header': posts render their own
      // <header class="post-head"> inside <main>, which is not a banner.
      const headerH = await page.getByRole('banner').evaluate((el) => el.getBoundingClientRect().height);
      const top = await h1.evaluate((el) => el.getBoundingClientRect().top);
      expect(top, `the <h1> on ${path} sits under the sticky header`).toBeGreaterThanOrEqual(headerH - 1);
    });

    test('the page scrolls all the way to the contact footer', async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await prep(page);

      // A container stuck at a fixed height, or a stray overflow:hidden, can
      // strand everything below it on a short viewport. The footer carries the
      // email CTA and the CV download, so it always has to be reachable.
      await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
      await page.waitForTimeout(300);
      await expect(page.locator('footer#contact')).toBeVisible();
    });

    test('every subresource the page requests loads', async ({ page }) => {
      // Catches the "vendored library is missing a directory" class of bug
      // (public/pdfjs/ has lost web/wasm/ and web/iccs/ that way), and any
      // media path that only some pages reference.
      const failures: string[] = [];
      page.on('response', (r) => {
        if (r.status() >= 400) failures.push(`${r.status()} ${r.url()}`);
      });

      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await prep(page);
      await page.waitForTimeout(1200);

      expect(failures, `${path} requested resources that failed: ${failures.join(', ')}`).toEqual([]);
    });
  });
}

test('the collapsed nav opens and every destination is reachable', async ({ page }, testInfo) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await prep(page);

  const width = page.viewportSize()!.width;
  const toggle = page.locator('#nav-toggle');
  const menu = page.locator('#nav-menu');

  // The hamburger is the only way to reach the nav at <= 720px, so if it or the
  // menu it opens breaks, the whole site becomes a single page on a phone.
  if (width <= 720) {
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(menu).toHaveClass(/open/);
  }

  const links = menu.locator('a');
  await expect(links).toHaveCount(7);

  const vw = page.viewportSize()!.width;
  for (const link of await links.all()) {
    await expect(link).toBeVisible();
    const box = (await link.boundingBox())!;
    expect(box.x, `a nav link is off-screen on ${testInfo.project.name}`).toBeGreaterThanOrEqual(-1);
    expect(box.x + box.width, `a nav link overflows the viewport`).toBeLessThanOrEqual(vw + 1);
  }
});

test('the collapsed nav can navigate to another page', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await prep(page);

  if (page.viewportSize()!.width <= 720) {
    await page.locator('#nav-toggle').click();
    await expect(page.locator('#nav-menu')).toHaveClass(/open/);
  }

  await page.locator('#nav-menu a[href="/research"]').click();
  await page.waitForURL(/\/research\/?$/);
  await expect(page.locator('h1').first()).toBeVisible();
});
