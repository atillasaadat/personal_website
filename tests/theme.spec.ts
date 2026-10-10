import { test, expect, type Page } from '@playwright/test';
import { blockExternals } from './_helpers';

// Default theme follows the sun: light from sunrise to sunset at the visitor's
// location (the `geo` cookie the middleware sets from Cloudflare), dark
// otherwise, 07:00 to 19:00 local without a location. A toggle click holds
// until the next sunrise/sunset. Los Angeles on 9 Oct 2026: sunrise ~06:53,
// sunset ~18:26 PDT.

test.use({ timezoneId: 'America/Los_Angeles' });

test.beforeEach(async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'theme logic, not layout');
  await blockExternals(page);
});

const at = (t: string) => new Date(`2026-10-09T${t}-07:00`);
const theme = (page: Page) => page.evaluate(() => document.documentElement.dataset.theme);

async function inLA(page: Page) {
  await page.context().addCookies([{ name: 'geo', value: '34.1,-118.2', url: 'http://localhost:4321' }]);
}

test('light between sunrise and sunset, dark outside it', async ({ page }) => {
  await inLA(page);
  for (const [t, want] of [['06:45:00', 'dark'], ['07:05:00', 'light'], ['12:00:00', 'light'], ['18:20:00', 'light'], ['18:35:00', 'dark'], ['23:00:00', 'dark']]) {
    await page.clock.setFixedTime(at(t));
    await page.goto('/about', { waitUntil: 'domcontentloaded' });
    expect(await theme(page), `at ${t}`).toBe(want);
  }
});

test('falls back to 07:00 to 19:00 local time without a location', async ({ page }) => {
  for (const [t, want] of [['06:30:00', 'dark'], ['10:00:00', 'light'], ['18:45:00', 'light'], ['19:15:00', 'dark']]) {
    await page.clock.setFixedTime(at(t));
    await page.goto('/about', { waitUntil: 'domcontentloaded' });
    expect(await theme(page), `at ${t}`).toBe(want);
  }
});

test('an old pinned theme no longer overrides the sun', async ({ page }) => {
  await inLA(page);
  await page.addInitScript(() => localStorage.setItem('theme', 'dark'));
  await page.clock.setFixedTime(at('12:00:00'));
  await page.goto('/about', { waitUntil: 'domcontentloaded' });
  expect(await theme(page)).toBe('light');
});

test('a toggle click holds until the next sunset, then auto resumes', async ({ page }) => {
  await inLA(page);
  await page.clock.install({ time: at('12:00:00') });
  await page.goto('/about');
  expect(await theme(page)).toBe('light');

  await page.locator('#theme-toggle').click();
  expect(await theme(page)).toBe('dark');
  await expect(page.locator('#theme-toggle')).toHaveAttribute('aria-pressed', 'false');

  await page.clock.setSystemTime(at('15:00:00'));
  await page.reload();
  expect(await theme(page), 'pick survives a reload before sunset').toBe('dark');

  // Next day at noon the pick has long expired: back to the sun.
  await page.clock.setSystemTime(new Date('2026-10-10T12:00:00-07:00'));
  await page.reload();
  expect(await theme(page)).toBe('light');
  expect(await page.evaluate(() => localStorage.getItem('theme-pick'))).toBeNull();
});

test('flips live at sunset while the page is open', async ({ page }) => {
  await inLA(page);
  await page.clock.install({ time: at('18:20:00') });
  await page.goto('/about');
  expect(await theme(page)).toBe('light');
  await expect(page.locator('#theme-toggle')).toHaveAttribute('aria-pressed', 'true');

  await page.clock.fastForward('10:00');
  expect(await theme(page)).toBe('dark');
  await expect(page.locator('#theme-toggle')).toHaveAttribute('aria-pressed', 'false');
});
