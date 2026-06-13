# Personal Website, atillasaadat.me

Personal portfolio and project blog for Atilla Saadat, Spacecraft GNC Engineer II at Varda Space Industries. The site showcases engineering projects, research, awards, and CV, primarily for employers and PhD program reviewers. Replaces the previous Wix site.

## Theme & Audience

- **Aesthetic**: space / GNC / spacecraft themed, sleek, clean, dark, technical. Interactive elements are welcome but must not hurt load time.
- **Audience**: recruiters, hiring managers, PhD admissions. Content reads like an engineering research profile.
- **Hard requirements**: responsive on mobile/tablet/desktop (the old Wix site had rendering problems), fast load, good SEO.

## Stack

- **Framework**: [Astro](https://astro.build), static output, content collections, zero JS by default. Client-side routing via `<ClientRouter />` (view transitions) gives smooth cross-page transitions with no hard refresh; the animated `Starfield` canvas uses `transition:persist` so the background never restarts between pages. Per-page scripts (link sweep, pageview beacon, post galleries/figures, SatMap lazy-load) run on the `astro:page-load` event so they re-fire on every navigation.
- **Content**: blog posts are markdown files in `src/content/posts/` with frontmatter (title, description, date, cover, tags). No raw HTML/CSS needed for content edits.
- **Social cards**: dynamic Open Graph / Twitter images are generated at build time (satori + resvg) by the endpoint `src/pages/og/[...route].png.ts` using the template in `src/lib/og.ts`, one branded 1200x630 card per page/post (profile photo + a short gist). `Base.astro` maps each route to `/og/<route>.png` for the `og:image`/`twitter:image` meta. `functions/oembed.js` adds an oEmbed provider (discovery `<link>` in `Base.astro`) pointing at the same cards.
- **Styling**: plain CSS with custom properties (design tokens) in `src/styles/`. No CSS framework.
- **Deployment**: Cloudflare Pages, auto-builds from GitHub on every push to `main` (`npm run build`, output `dist`). Custom domain `atillasaadat.me` via Cloudflare DNS. See `README.md` for full setup.
- **Analytics**: Cloudflare Pages Functions in `functions/` (`track.js` beacon + `insights.js` dashboard) backed by a D1 database (`wrangler.toml`, `schema.sql`). Private dashboard at `/insights` (Basic Auth, `ADMIN_PASSWORD` env var).

## Commands

```bash
npm run dev       # local dev server at localhost:4321
npm run build     # production build to dist/
npm run preview   # preview the production build
```

## Repository Layout

```
src/
  content/posts/      # blog posts (markdown), one file per project post
  pages/              # routes: index, projects, cv, 404, post/[slug]
  components/         # Astro components (header, footer, cards, satmap, …)
  layouts/            # base + post layouts
  styles/             # global.css, design tokens
public/
  media/<slug>/       # per-post images & videos (migrated from Wix CDN)
  files/              # CV PDF, papers, other downloadable documents
scrape/               # ARCHIVE: scraped Wix site (html, extracted md, media), reference only, not deployed
site_files/           # ARCHIVE: raw Wix media export, reference only, not deployed
```

`scrape/` and `site_files/` are kept as migration reference. Do not delete; do not deploy.

## Content Workflow (how the site gets updated)

1. **New/edited blog post**: edit or add a `.md` file in `src/content/posts/`, put media in `public/media/<slug>/`, push to `main`. CI rebuilds and the live site updates in ~1-2 min.
2. **CV update**: replace `public/files/Atilla_Saadat_CV.pdf`, push. The CV page embeds and links this file.
3. Never hand-edit `dist/`, it is build output.

## Site Structure (parity with old Wix site)

| Route | Content |
|---|---|
| `/` | Hero/about (GNC Engineer II @ Varda), specialties, projects grid, live 3D satellite map (Cesium globe), awards, contact/social |
| `/projects` | Index of all posts, newest first |
| `/post/<slug>` | Individual project/blog post, **slugs must match the old Wix URLs** to preserve inbound links |
| `/cv` | Embedded + downloadable CV PDF |

Social: [LinkedIn](https://linkedin.com/in/atillasaadat), [GitHub](https://github.com/atillasaadat), [Twitter](https://twitter.com/atillasaadat), [Devpost](https://devpost.com/atillasaadat), [ResearchGate](https://www.researchgate.net/profile/Atilla_Saadat).

Satellite map: a self-contained CesiumJS globe at `public/satmap.html` (the user's working Wix code, dropped in unchanged). `src/components/SatMap.astro` auto-loads it in an iframe when the section scrolls into view, so the heavy Cesium bundle never costs the homepage's initial load. It pulls live TLEs from Celestrak per NORAD ID (cached 6h in localStorage) with an embedded fallback snapshot; IDs that return "no GP data" are shown as decayed/re-entered. The 20 NORAD IDs and their fallback TLEs live inside `public/satmap.html`, edit there to add/remove satellites.

## Writing Style

- **Never use em dashes or en dashes (the long horizontal dash characters, U+2014 and U+2013) in any user-facing text.** This applies to all post content, frontmatter (titles, descriptions, highlights), page copy, captions, and award text. Rewrite sentences to flow naturally using commas, colons, parentheses, periods, or the word "to" for ranges. (Plain hyphens `-` in compound words and code are fine.)

## Conventions

- Keep posts' frontmatter schema in sync with `src/content.config.ts` (zod-validated).
- Images in posts: reference `/media/<slug>/…` paths; prefer original-resolution files, let Astro/`loading="lazy"` handle perf.
- Don't add client-side JS frameworks (React/Vue) for static content, use Astro components; small vanilla `<script>` islands are fine for interactivity.
- Preserve old Wix post slugs in any URL changes; add redirects if a slug must change.
- Run `npm run build` before committing layout/component changes, it type-checks content frontmatter.
