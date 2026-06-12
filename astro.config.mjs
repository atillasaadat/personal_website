// @ts-check
import { defineConfig } from 'astro/config';
import sitemap from '@astrojs/sitemap';

export default defineConfig({
  site: 'https://atillasaadat.me',
  integrations: [sitemap()],
  build: {
    inlineStylesheets: 'auto',
  },
});
