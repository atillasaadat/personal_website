import { test, expect } from '@playwright/test';
import { PAGES, blockExternals, prep } from './_helpers';

test.beforeEach(async ({ page }) => {
  await blockExternals(page);
});

for (const { path, name } of PAGES) {
  test.describe(name, () => {
    test('no horizontal overflow (page does not scroll sideways)', async ({ page }, testInfo) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await prep(page);
      await page.waitForTimeout(250);

      const { scrollW, clientW } = await page.evaluate(() => ({
        scrollW: document.documentElement.scrollWidth,
        clientW: document.documentElement.clientWidth,
      }));

      // Attach a full-page screenshot to the report for quick visual review.
      await testInfo.attach(`${name}-${testInfo.project.name}`, {
        body: await page.screenshot({ fullPage: true }),
        contentType: 'image/png',
      });

      expect(scrollW, `${path} scrolls horizontally on ${testInfo.project.name}`).toBeLessThanOrEqual(
        clientW + 1,
      );
    });

    test('no element spills past the viewport width', async ({ page }, testInfo) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await prep(page);
      await page.waitForTimeout(150);

      const vw = page.viewportSize()!.width;
      const offenders = await page.evaluate((vw) => {
        const sel = 'img, video, iframe, pre, table, .embed, .slides, .li-embed, h1, h2';
        // Content inside a horizontally scrollable/clipped container (e.g. the
        // gallery thumbnail strip or a wide table set to overflow-x:auto) can
        // legitimately extend past the viewport; it is contained, not a bug.
        const inScrollContainer = (el: Element) => {
          let p = el.parentElement;
          while (p && p !== document.body) {
            const ox = getComputedStyle(p).overflowX;
            if (ox === 'auto' || ox === 'scroll' || ox === 'hidden') return true;
            p = p.parentElement;
          }
          return false;
        };
        return Array.from(document.querySelectorAll(sel))
          .filter((el) => !inScrollContainer(el))
          .map((el) => {
            const r = el.getBoundingClientRect();
            return { tag: el.tagName, cls: (el as HTMLElement).className, right: Math.round(r.right), width: Math.round(r.width) };
          })
          .filter((b) => b.width > 0 && b.right > vw + 2);
      }, vw);

      expect(offenders, `elements overflow the viewport on ${path}: ${JSON.stringify(offenders)}`).toEqual([]);
    });
  });
}
