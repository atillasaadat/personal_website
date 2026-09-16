import { test, expect } from '@playwright/test';
import { PAGES, blockExternals, prep } from './_helpers';

// General mobile-reader checks, run on the phone and tablet projects.
//
// mobile.spec.ts asks "is it there and can I reach it". This file asks the
// next question: is what a phone reader gets actually usable -- legible text,
// tappable controls, media that behaves on iOS, anchors that do not land under
// the sticky header, and an image viewer that fits on the screen.

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === 'desktop', 'small-screen behaviour only');
  await blockExternals(page);
});

// Anything the reader taps that is not a link inside a sentence. WCAG 2.2's
// target-size minimum exempts inline links in running text, and the site relies
// on that exemption for prose links, so they are excluded here too.
const STANDALONE_CONTROLS =
  'button, .btn, header nav a, .card a, .actions a, .gallery-thumb, .ag-arrow, .ag-toggle';

for (const { path, name } of PAGES) {
  test.describe(name, () => {
    test('no text is rendered below the legibility floor', async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await prep(page);
      await page.waitForTimeout(400);

      // The site's smallest deliberate type is the 11.2px mono chips and
      // labels. 11px is the floor: anything under it is a mistake (an
      // unscaled rem, a nested em), not a design choice.
      const tiny = await page.evaluate(() => {
        const shown = (el: Element) =>
          el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
        return Array.from(
          document.querySelectorAll('p, li, td, th, span, a, figcaption, dd, dt, h1, h2, h3, h4'),
        )
          .filter((el) => shown(el) && el.textContent!.trim().length > 0)
          .map((el) => ({
            tag: el.tagName,
            cls: String((el as HTMLElement).className).slice(0, 30),
            size: parseFloat(getComputedStyle(el).fontSize),
            text: el.textContent!.trim().slice(0, 25),
          }))
          .filter((b) => b.size < 11);
      });

      expect(tiny, `text below 11px on ${path}: ${JSON.stringify(tiny)}`).toEqual([]);
    });

    test('standalone controls meet the minimum tap target size', async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await prep(page);
      await page.waitForTimeout(400);

      // 24px is the site's documented invariant (WCAG 2.2 target-size minimum),
      // held by min-height on the small mono links rather than a larger font.
      const small = await page.evaluate((sel) => {
        const shown = (el: Element) =>
          el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden';
        return Array.from(document.querySelectorAll(sel))
          .filter(shown)
          .map((el) => {
            const r = el.getBoundingClientRect();
            return {
              tag: el.tagName,
              cls: String((el as HTMLElement).className).slice(0, 30),
              h: Math.round(r.height),
              w: Math.round(r.width),
              text: el.textContent!.trim().slice(0, 20),
            };
          })
          .filter((b) => b.h < 24 || b.w < 24);
      }, STANDALONE_CONTROLS);

      expect(small, `tap targets under 24px on ${path}: ${JSON.stringify(small)}`).toEqual([]);
    });

    test('every video is inline-safe and every image is dimensioned', async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await prep(page);
      await page.waitForTimeout(800);

      const media = await page.evaluate(() => ({
        // Without playsinline, iOS takes any playing <video> fullscreen and
        // hands control to the system player. Every video on the site has it;
        // a new post that forgets it breaks only on iPhones.
        noPlaysinline: Array.from(document.querySelectorAll('video'))
          .filter((v) => !v.hasAttribute('playsinline'))
          .map((v) => v.querySelector('source')?.getAttribute('src') ?? v.getAttribute('src') ?? '?'),
        // Every <img> carries width/height so nothing reflows as media
        // arrives. This matters most on a phone, where a late reflow moves the
        // line the reader is on.
        undimensioned: Array.from(document.querySelectorAll('img'))
          .filter((i) => !i.getAttribute('width') || !i.getAttribute('height'))
          .map((i) => i.getAttribute('src') ?? '?'),
      }));

      expect(media.noPlaysinline, `videos missing playsinline on ${path}`).toEqual([]);
      expect(media.undimensioned, `images without width/height on ${path}`).toEqual([]);
    });

    test('wide content scrolls inside its own container, not the page', async ({ page }) => {
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await prep(page);
      await page.waitForTimeout(600);

      // A table or code block wider than a phone must scroll by itself. If it
      // does not, it drags the whole page sideways, which is the single most
      // common way a desktop-built layout breaks on a phone.
      const loose = await page.evaluate(() => {
        const scrolls = (el: Element) => {
          let p: Element | null = el;
          while (p && p !== document.body) {
            const ox = getComputedStyle(p).overflowX;
            if (ox === 'auto' || ox === 'scroll' || ox === 'hidden') return true;
            p = p.parentElement;
          }
          return false;
        };
        return Array.from(document.querySelectorAll('table, pre'))
          .filter((el) => el.scrollWidth > document.documentElement.clientWidth + 1 && !scrolls(el))
          .map((el) => `${el.tagName}.${String((el as HTMLElement).className).slice(0, 30)}`);
      });

      expect(loose, `wide content that drags the page sideways on ${path}: ${loose.join(', ')}`).toEqual([]);
    });
  });
}

test.describe('homepage anchors', () => {
  // The nav's Projects, Awards and Globe entries scroll to a section rather
  // than loading a page. With a sticky header, the landing spot has to clear
  // it, which is what scroll-padding-top and the sections' negative
  // scroll-margin-top are tuned for. Getting that wrong is invisible on
  // desktop and puts the section title behind the header on a phone.
  for (const id of ['projects', 'awards', 'satmap', 'contact']) {
    test(`#${id} lands below the sticky header`, async ({ page }) => {
      await page.goto(`/#${id}`, { waitUntil: 'domcontentloaded' });
      await prep(page);
      await page.waitForTimeout(700);

      const { headingTop, headerH } = await page.evaluate((id) => {
        const section = document.getElementById(id)!;
        const heading = section.querySelector('h1, h2, h3')!;
        return {
          headingTop: heading.getBoundingClientRect().top,
          headerH: document.querySelector('header')!.getBoundingClientRect().height,
        };
      }, id);

      expect(headingTop, `the #${id} heading lands under the sticky header`).toBeGreaterThanOrEqual(
        headerH - 2,
      );
    });
  }
});

test('the image viewer fits the screen and can be dismissed', async ({ page }) => {
  await page.goto('/post/gnc-engineer-varda-space', { waitUntil: 'domcontentloaded' });
  await prep(page);
  await page.waitForTimeout(800);

  const figure = page.locator('.post-body img').first();
  await figure.scrollIntoViewIfNeeded();
  await figure.click();

  const dialog = page.locator('.lightbox');
  await expect(dialog).toBeVisible();

  // Everything the reader needs (the image, the close button, the caption) has
  // to be on screen. On a phone there is no room to spare, and a control that
  // renders past the bottom edge is simply unreachable.
  const fits = await page.evaluate(() => {
    const d = document.querySelector('.lightbox')!;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    return Array.from(d.querySelectorAll('img, button'))
      .filter((el) => el.getClientRects().length > 0)
      .map((el) => {
        const r = el.getBoundingClientRect();
        return { tag: el.tagName, cls: String((el as HTMLElement).className).slice(0, 25), top: Math.round(r.top), bottom: Math.round(r.bottom), left: Math.round(r.left), right: Math.round(r.right) };
      })
      .filter((b) => b.bottom > vh + 1 || b.right > vw + 1 || b.top < -1 || b.left < -1);
  });
  expect(fits, `image viewer content is off-screen: ${JSON.stringify(fits)}`).toEqual([]);

  // Esc is a keyboard affordance; on touch the close button is the way out.
  await page.locator('.lightbox button').first().click();
  await expect(dialog).toBeHidden();
});

test('the viewport allows pinch zoom', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  // user-scalable=no / maximum-scale locks out pinch zoom, which is the main
  // accessibility affordance on a phone. Easy to add by reflex when fighting a
  // layout bug, so pin it.
  const content = await page.locator('meta[name="viewport"]').getAttribute('content');
  expect(content).toContain('width=device-width');
  expect(content).not.toContain('user-scalable=no');
  expect(content).not.toMatch(/maximum-scale\s*=\s*1/);
});
