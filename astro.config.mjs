// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://atillasaadat.com',
  integrations: [
    sitemap({
      // Keep redirect-only routes (/projects, /resume) out of the sitemap so
      // Google isn't told to index URLs that immediately 301/refresh away.
      filter: (page) => !/\/(projects|resume)\/?$/.test(page),
      changefreq: 'monthly',
      priority: 0.7,
      lastmod: new Date(),
      serialize(item) {
        if (item.url === 'https://atillasaadat.com/') {
          item.priority = 1.0;
          item.changefreq = 'weekly';
        } else if (item.url.includes('/post/')) {
          item.priority = 0.8;
        } else if (item.url.endsWith('/cv/')) {
          item.priority = 0.6;
        }
        return item;
      },
    }),
  ],
  build: {
    inlineStylesheets: 'auto',
  },
});
