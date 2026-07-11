# Personal Website, atillasaadat.com

Personal portfolio and project blog for Atilla Saadat, Spacecraft GNC Engineer II at Varda Space Industries. The site showcases engineering projects, research, awards, and CV, primarily for employers and PhD program reviewers. Replaces the previous Wix site.

## Theme & Audience

- **Aesthetic**: space / GNC / spacecraft themed, sleek, clean, dark, technical. Interactive elements are welcome but must not hurt load time.
- **Audience**: recruiters, hiring managers, PhD admissions. Content reads like an engineering research profile.
- **Hard requirements**: responsive on mobile/tablet/desktop (the old Wix site had rendering problems), fast load, good SEO.

## Stack

- **Framework**: [Astro](https://astro.build), static output, content collections, zero JS by default. Client-side routing via `<ClientRouter />` (view transitions) gives smooth cross-page transitions with no hard refresh; the animated `Starfield` canvas uses `transition:persist` so the background never restarts between pages. Per-page scripts (link sweep, pageview beacon, post galleries/figures, SatMap lazy-load) run on the `astro:page-load` event so they re-fire on every navigation.
- **Content**: blog posts are markdown files in `src/content/posts/` with frontmatter (title, description, date, cover, tags). No raw HTML/CSS needed for content edits.
- **Social cards**: dynamic Open Graph / Twitter images are generated at build time (satori + resvg) by the endpoint `src/pages/og/[...route].png.ts` using the template in `src/lib/og.ts`, one branded 1200x630 card per page/post (profile photo + a short gist). `Base.astro` maps each route to `/og/<route>.png` for the `og:image`/`twitter:image` meta. `functions/oembed.js` adds an oEmbed provider (discovery `<link>` in `Base.astro`) pointing at the same cards.
- **SEO**: `Base.astro` emits canonical, Open Graph (`og:type` is `article` for posts, with `article:*` meta), Twitter card meta, and JSON-LD structured data. Every page carries a `@graph` of `Person` (the "Atilla Saadat" entity, with `sameAs` social profiles) + `WebSite`; posts add `BlogPosting` + `BreadcrumbList` (built in `Post.astro`). The Person/WebSite nodes are referenced by `@id` so per-page nodes link back without repeating data. JSON-LD `image` must be a real image, so `Post.astro` falls back to the PNG OG card when a post `cover` is a video (`.mp4`). `public/robots.txt` points crawlers at `/sitemap-index.xml` and disallows `/insights`; the sitemap (`astro.config.mjs`) sets per-route priority/changefreq and filters out the redirect-only routes (`/projects`, `/resume`). Pass `noindex={true}` to `Base.astro` to keep a page out of the index (e.g. `404.astro`).
- **Styling**: plain CSS with custom properties (design tokens) in `src/styles/`. No CSS framework.
- **Deployment**: Cloudflare Pages, auto-builds from GitHub on every push to `main` (`npm run build`, output `dist`). Custom domain `atillasaadat.com` (registered through Cloudflare, so DNS is already in the account) via Cloudflare DNS. See `README.md` for full setup.
- **Analytics**: Cloudflare Pages Functions in `functions/` (`track.js` beacon + `insights.js` dashboard) backed by a D1 database (`wrangler.toml`, `schema.sql`; column-add migrations in `migrations.sql`). Private dashboard at `/insights` (Basic Auth, `ADMIN_PASSWORD` env var). `track.js` filters bots aggressively (UA + fetch-metadata + `Accept-Language` + Cloudflare verified-bot + hosting/VPS network org) and records, per visit, the Cloudflare-reported network org (`cf.asOrganization`, used to surface likely employer/institution visits), the external referrer (passed from the client as `&r=document.referrer`, since the beacon's own `Referer` is always the site), and an optional landing-link tag (`&s=` from a `?source=` or `?utm_source=` query param, e.g. linking `atillasaadat.com?source=CV` in the CV, surfaced in the dashboard's "Link sources" table). The dashboard defaults to the Today range and classifies orgs (institution/company/consumer-ISP/hosting) to highlight employer/institution traffic. It also records per-page dwell time: the client beacon sends a per-pageview id (`&i=`) on load and then reports cumulative active (tab-visible) time via `navigator.sendBeacon` (a POST to `/track`) on tab-hide / navigation / unload; `track.js`'s `onRequestPost` writes it to that row's `dur` column (kept as the max seen), surfaced as avg time on site / per page. It also tracks file downloads: a delegated click handler in `Base.astro` fires a `&e=dl` beacon when a same-origin `/files/…` link carrying the `download` attribute is clicked (the CV PDF's "Download PDF" button + the fallback link; the "Open in new tab" inline view is deliberately not counted), which `track.js` records in a separate `downloads` table (same bot filtering + Cloudflare geo/org, kept out of the `pageviews` table so downloads never inflate page-view or dwell stats). The dashboard shows a "CV downloads" count card and a "CV & file downloads" table breaking each download down by file, location, and network org (to spot an employer downloading the CV). It also tracks scroll depth (the dwell beacon reports max scroll % into `pageviews.scroll`, surfaced as "Avg read" per page) and outbound/CTA clicks: the same delegated handler fires `&e=click` beacons for the email (mailto, `k=email`), social-profile links (`k=social`), and other external links (`k=outbound`), recorded in a separate `events` table and shown in an "Email, social & outbound clicks" table. These feed three engagement sections computed in `insights.js` from engaged pageviews joined with per-visitor downloads/clicks: a "High-intent visitors" board (visitors ranked by a transparent additive score over returning visits, project depth, dwell, CV download, and email/social clicks, with company/institution networks weighted up), a "Sessions & engagement" strip (sessions split on a 30-min idle gap, bounce rate, pages/session, avg session length), and "Visitor journeys" (each top visitor's session-by-session page path). Owner self-exclusion and "Clear all data" also cover the `events` table. Owner self-exclusion: loading the authenticated `/insights` dashboard sets a long-lived `notrack=1` cookie that `track.js` honors (never records that browser again) and deletes any visits already recorded from that machine (matched by the `vid` tracking cookie), including its `downloads` rows, so my own visits stay out of the analytics.

## Commands

```bash
npm run dev       # local dev server at localhost:4321
npm run build     # production build to dist/
npm run preview   # preview the production build
npm test          # Playwright responsive tests across mobile/tablet/desktop viewports
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
| `/` | Hero/about (GNC Engineer II @ Varda), specialties, projects grid (`#projects`, the full post list), live 3D satellite map (Cesium globe), awards (`#awards`), contact/social. The nav "Projects" and "Awards" links scroll to these sections rather than separate pages. |
| `/projects` | Redirects to `/#projects` (the homepage section). Kept only so old/bookmarked links don't 404. |
| `/research` | PhD-style research record: a two-column hero (intro + ORCID/Scholar/ResearchGate profile links on the left, auto-looping research photo gallery on the right), then interests, research positions (with advisors), and publications grouped by type (thesis, journal, conference, technical reports, patents, posters) plus academic service. Data-driven from arrays in `research.astro`; each entry links its paper/DOI/Google-Patents source and a "Project Page" cross-link to the related on-site post. |
| `/about` | Two-column layout: bio text on the left, auto-looping photo gallery on the right (images in `public/media/about-me/`), then skills matrix, experience/education timeline (org names link to company/school sites), and certifications/affiliations (EMT, PADI Rescue Diver, Civil Air Patrol, AIAA). |
| `/mit-ai-competition-model-description` | Redirect (301) to `/post/mit-storm-ai-challenge`. The self-hosted STORM model-description PDF was retired; the paper now lives on ResearchGate, linked from the post and `/research`. |
| `/post/<slug>` | Individual project/blog post, **slugs must match the old Wix URLs** to preserve inbound links |
| `/cv` | Embedded + downloadable CV PDF |

Contact: primary email is `contact@atillasaadat.com` (mailto CTA + Download CV button live in the sitewide `Footer.astro`). New page routes must be added to: the `Header.astro` nav, the OG card list in `src/pages/og/[...route].png.ts` + the `ogRoute` map in `Base.astro`, and the `PAGES` list in `tests/_helpers.ts`.

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
- Run `npm test` after layout/CSS/component changes: Playwright checks the key pages at 4 viewports (360/390/820/1440px) for horizontal overflow, elements spilling past the viewport, and working navigation. CI (`.github/workflows/ci.yml`) runs the same on every push/PR. Add a page to the `PAGES` list in `tests/_helpers.ts` when a new layout pattern is introduced.
