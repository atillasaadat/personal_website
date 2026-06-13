import { test, expect } from '@playwright/test';
import { blockExternals, prep } from './_helpers';

test.beforeEach(async ({ page }) => {
  await blockExternals(page);
});

test('header renders correctly and Projects scrolls to its section', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await prep(page);

  const width = page.viewportSize()!.width;
  const toggle = page.locator('#nav-toggle');
  const projectsLink = page.locator('#nav-menu a[href="/#projects"]');

  // The nav collapses to a hamburger at <= 720px (matches the CSS media query).
  if (width <= 720) {
    await expect(toggle).toBeVisible();
    await toggle.click();
    await expect(page.locator('#nav-menu')).toHaveClass(/open/);
  } else {
    await expect(toggle).toBeHidden();
    await expect(projectsLink).toBeVisible();
  }

  // Projects behaves like Awards: it scrolls to the on-page section, not a new page.
  await projectsLink.click();
  await expect(page).toHaveURL(/#projects$/);
  const top = await page.locator('#projects').evaluate((el) => el.getBoundingClientRect().top);
  expect(Math.abs(top), 'projects section should be scrolled near the top').toBeLessThan(140);
});

test('home hero and key sections are visible', async ({ page }) => {
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  await prep(page);

  await expect(page.locator('h1')).toHaveText(/Atilla Saadat/);
  await expect(page.locator('#projects')).toBeVisible();
  await expect(page.locator('#awards')).toBeVisible();
  await expect(page.locator('.hero-photo img')).toBeVisible();
});

test('/projects redirects to the homepage projects section', async ({ page }) => {
  await page.goto('/projects', { waitUntil: 'domcontentloaded' });
  await page.waitForURL(/#projects$/, { timeout: 5000 });
  await expect(page.locator('#projects')).toBeVisible();
});
