import { defineConfig } from '@playwright/test';

// Unit tests for the Cloudflare Pages Functions in /functions (the country
// block, the pageview beacon, the insights dashboard). They run the Functions
// directly in Node, so they need no browser and no server: `astro preview`
// serves only the static build and never executes edge Functions, which is why
// this code cannot be covered by the responsive/browser suite.
//
// They are also the only tests that touch the analytics database, and they only
// ever touch a throwaway in-memory SQLite one created from schema.sql (see
// tests/unit/_analytics.ts). The production D1 database is never reachable from
// here: no wrangler, no network, no database_id.
//
// Kept as a separate config so `npm run test:unit` is a fast, dependency-free
// check (no `npm run build`, no Playwright browser download) that CI can run as
// its own job.
export default defineConfig({
  testDir: './tests/unit',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [['github'], ['list']] : [['list']],
});
