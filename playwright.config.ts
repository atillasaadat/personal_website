import { defineConfig, devices } from '@playwright/test';

// Responsive / cross-device checks. Each "project" is a viewport size; the
// specs in tests/ run against all of them, so a layout that breaks on phones,
// tablets, or desktop fails CI before it ships.
export default defineConfig({
  testDir: './tests',
  // tests/unit holds the Cloudflare Function tests: no browser, no server, and
  // no point running them once per viewport. They have their own config
  // (playwright.unit.config.ts), run by `npm run test:unit`.
  testIgnore: '**/unit/**',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],

  use: {
    baseURL: 'http://localhost:4321',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  // Breakpoints chosen around the site's CSS media queries (720px nav, 560px
  // cards). All pinned to Chromium so CI only needs the one browser binary.
  projects: [
    { name: 'mobile-small', use: { ...devices['Desktop Chrome'], viewport: { width: 360, height: 740 }, hasTouch: true } },
    { name: 'mobile', use: { ...devices['Desktop Chrome'], viewport: { width: 390, height: 844 }, hasTouch: true } },
    { name: 'tablet', use: { ...devices['Desktop Chrome'], viewport: { width: 820, height: 1180 }, hasTouch: true } },
    { name: 'desktop', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
  ],

  // Build the static site and serve the real production output, exactly like prod.
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4321',
    reuseExistingServer: !process.env.CI,
    timeout: 180_000,
    stdout: 'pipe',
  },
});
