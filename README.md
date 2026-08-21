# atillasaadat.com

Personal portfolio and project blog for Atilla Saadat, Spacecraft GNC Engineer. Built with [Astro](https://astro.build): a fast, static site where blog posts are plain Markdown files and the whole thing redeploys automatically when you push to GitHub.

- **Live site:** https://atillasaadat.com
- **Stack:** Astro 5 (static output), vanilla CSS, a CesiumJS satellite globe, and Cloudflare Pages Functions + D1 for private visitor analytics.

---

## 1. Set up on a fresh machine

You need [Node.js](https://nodejs.org) version 20 or newer (which includes `npm`).

```bash
# 1. Install Node 20+ (check with: node --version)
# 2. Clone the repo
git clone https://github.com/<your-username>/personal_website.git
cd personal_website

# 3. Install dependencies
npm install
```

That is everything required to run and edit the site locally.

## 2. Run it locally

```bash
npm run dev
```

Open http://localhost:4321. The dev server hot-reloads as you edit files.

> Note: `npm run dev` runs only the static site. The visitor-analytics endpoints (`/track`, `/insights`) are Cloudflare Functions and do not run under `astro dev`; the tracking beacon simply does nothing locally. To exercise the Functions locally, see section 7.

## 3. Build and preview the production output

```bash
npm run build      # outputs the static site to dist/
npm run preview    # serves dist/ at http://localhost:4321 to preview the real build
```

`npm run build` also type-checks every post's frontmatter against the schema in `src/content.config.ts`, so run it before pushing to catch mistakes.

## 4. Make edits

### Add or edit a blog post
1. Create or edit a Markdown file in `src/content/posts/`. The file name becomes the URL slug (`my-post.md` to `/post/my-post`).
2. Put images and videos for that post in `public/media/<slug>/` and reference them as `/media/<slug>/file.jpg`.
3. Each post starts with frontmatter:

   ```markdown
   ---
   title: "My Project Title"
   description: "One-sentence summary used on cards and for SEO."
   date: 2026-06-01
   cover: "/media/covers/my-post.webp"   # thumbnail (image or .mp4)
   tags: ["GNC", "Research"]
   highlight: "1st place: Some Competition"            # optional gold badge
   highlightHref: "https://example.com/the-award"       # optional link for the badge
   ---

   Your Markdown content here.
   ```

4. **Galleries:** if you place several images one after another in a post, the site automatically turns them into a single gallery viewer (main image plus a thumbnail strip). Just list the images consecutively.
5. **Floated / centered images:** use `<figure class="float-right">…</figure>` (or `float-left`, or `centered`) for tall images you want text to wrap around. See `winsat-rocketry-division-data-acquisition-module.md` for examples.
6. **YouTube embeds:** `<div class="embed"><iframe src="https://www.youtube-nocookie.com/embed/VIDEO_ID" loading="lazy" allowfullscreen></iframe></div>`.

### Update the CV
Replace `public/files/Atilla_Saadat_CV.pdf` with the new file (keep the same name). The `/cv` page embeds and links it automatically.

### Update awards / homepage
Edit the `awardsData` array and copy in `src/pages/index.astro`.

### Update the satellite globe
The NORAD IDs and fallback orbital data live in `public/satmap.html`.

### Writing rule
**Do not use em dashes or en dashes anywhere in the text.** Rewrite with commas, colons, parentheses, or the word "to" for ranges. (This is also noted in `CLAUDE.md`.)

After any edit: `git add -A && git commit -m "..." && git push`. The live site rebuilds automatically (section 6).

## 5. Test

Two gates protect the site:

**1. Build (content/type check)**
```bash
npm run build      # fails if any post frontmatter is invalid
```

**2. Responsive / cross-device tests (Playwright)**

These build the site, serve the real production output, and load the key pages at four viewport sizes (small phone 360px, phone 390px, tablet 820px, desktop 1440px), checking that:
- the page never scrolls sideways (no horizontal overflow),
- no image, video, table, or embed spills past the viewport,
- the header works per device (hamburger menu on mobile, inline links on desktop) and the Projects link scrolls to its section,
- the hero and key sections render.

```bash
npx playwright install --with-deps chromium   # one-time: download the browser
npm test                                        # run all viewport tests
npm run test:ui                                 # interactive runner (great for debugging)
npm run test:report                             # open the last HTML report
```

The HTML report includes a **full-page screenshot of every page on every device**, so you can eyeball each layout after a change. Test files live in `tests/`; viewports are defined in `playwright.config.ts`.

These run automatically in CI on every push and pull request (see section 8), so a change that breaks a mobile, tablet, or desktop layout fails before it deploys.

## 6. Host it in production (recommended: Cloudflare Pages, free)

**Use [Cloudflare Pages](https://pages.cloudflare.com/).** It is free, fast, deploys automatically from GitHub, and (unlike GitHub Pages) it can run the serverless Functions and database this project uses for visitor analytics. The visitor-tracking feature **requires** Cloudflare Pages (or an equivalent with serverless plus a database); a purely static host like GitHub Pages cannot do it.

### One-time deploy setup
1. Push this repo to GitHub.
2. Create a free Cloudflare account, go to **Workers & Pages, Create, Pages, Connect to Git**, and pick this repo.
3. Build settings:
   - **Framework preset:** Astro
   - **Build command:** `npm run build`
   - **Build output directory:** `dist`
4. Click **Save and Deploy**. From now on, every `git push` to the main branch rebuilds and deploys the site.

### Set up visitor analytics (D1 database)
The D1 binding in `wrangler.toml` ships **commented out** so the site deploys before the database exists. Analytics stays dormant (the `/track` beacon records nothing, `/insights` shows zeros) until you enable it. To enable it, run these locally once (they talk to your Cloudflare account; `wrangler` will prompt you to log in):

```bash
# 1. Log in to Cloudflare
npx wrangler login

# 2. Create the database (prints a database_id)
npx wrangler d1 create site-analytics

# 3. In wrangler.toml, UNCOMMENT the four [[d1_databases]] lines and paste the
#    printed database_id in place of REPLACE_WITH_YOUR_D1_DATABASE_ID.

# 4. Create the table in the live database
npx wrangler d1 execute site-analytics --remote --file=./schema.sql

# 5. Commit and push so the next deploy picks up the binding
git add wrangler.toml && git commit -m "enable analytics" && git push
```

> **Already running an older schema?** If the `pageviews` table predates the
> network-org / referrer columns, add them once (existing data is preserved):
> ```bash
> npx wrangler d1 execute site-analytics --remote --command "ALTER TABLE pageviews ADD COLUMN asn INTEGER"
> npx wrangler d1 execute site-analytics --remote --command "ALTER TABLE pageviews ADD COLUMN org TEXT"
> npx wrangler d1 execute site-analytics --remote --command "ALTER TABLE pageviews ADD COLUMN ref TEXT"
> ```
> The dashboard degrades gracefully until these exist; new visits populate them once added.

Then in the Cloudflare dashboard for your Pages project:
1. **Settings, Variables and Secrets, Add:** add `ADMIN_PASSWORD` (the password for your private analytics page at `/insights`). Mark it as a **Secret**, then redeploy (Deployments, retry latest) so it takes effect.

> Note: because this project uses `wrangler.toml`, the D1 binding must live in that file (uncommented, with the real id), not in the dashboard Bindings tab. The dashboard Bindings tab is ignored when `wrangler.toml` is present.

### Connect your domain (`atillasaadat.com`, registered with Cloudflare)
Because the domain was bought through **Cloudflare Registrar**, it is already in your Cloudflare account with Cloudflare managing its DNS, so there are **no nameservers to change**. You just attach it to the Pages project:

1. In the Cloudflare dashboard, go to **Workers & Pages, your project, Custom domains, Set up a custom domain**.
2. Enter `atillasaadat.com` and confirm. Cloudflare automatically adds the DNS record (pointing the domain at your `*.pages.dev` target) and provisions an HTTPS certificate, usually within a minute.
3. Optionally repeat for `www.atillasaadat.com`. Cloudflare can redirect `www` to the apex for you.

Because Cloudflare proxies the domain, the city/region/country visitor geolocation used by the analytics works automatically, with nothing extra to configure.

> **Keeping the old `atillasaadat.me` working (optional).** If you still own the `.me` domain and want old links to keep resolving, either add `atillasaadat.me` as a second custom domain on the same Pages project, or, in the `atillasaadat.me` zone, add a **Redirect Rule** (Rules, Redirect Rules) that 301-redirects all traffic to `https://atillasaadat.com`. The site already treats both `.com` and `.me` hosts as internal links, so navigation stays consistent during the transition.

## 7. Visitor analytics (private dashboard)

- Every page quietly loads `/track?p=<path>`, a Cloudflare Function that records the visit (path, an anonymous visitor cookie, Cloudflare-provided city / region / country, the visitor's **network organization** via `cf.asOrganization`, and the **external referrer** the visit came from) into the D1 database. It never blocks or slows the page.
- The beacon filters out bots/crawlers/scanners before recording: it requires a real browser User-Agent, browser fetch-metadata and `Accept-Language` headers, drops Cloudflare-verified bots, and drops traffic from pure hosting / VPS networks (OVH, Hetzner, DigitalOcean, Linode, Vultr, etc.) where genuine human visitors never originate. The big clouds (AWS/GCP/Azure) are left in but shown by org so you can judge them.
- View the data at **https://atillasaadat.com/insights**. The page shows a password prompt (checked against `ADMIN_PASSWORD`); the browser then remembers it in a cookie scoped to `/insights`, so you enter it once per browser. It deliberately does not use HTTP Basic Auth: browsers resend cached Basic credentials on every request to the site, which tripped Cloudflare's leaked-credential rate-limit rule (Error 1015) and blocked normal browsing.
- The dashboard shows unique visitors, total page views, a country/city **map** (countries shaded by visitors with city dots on top), a **Possible employers & institutions** table (networks that aren't consumer ISPs or hosting providers, e.g. a company or university network), **traffic sources** (referrers), top pages, visits by city / region / country, and a collapsible **All networks** list. Filters: **Today (default), Yesterday, Last 7 days, Last 30 days, Last year, and All time** (times in UTC). It is marked `noindex`, so search engines ignore it.

> **On "company / institution" detection:** Cloudflare reports the network each visit comes from (`cf.asOrganization`). On a corporate or campus network this is often the employer's or university's name; on home/mobile connections it's the ISP. The dashboard classifies orgs (institution / company / consumer ISP / hosting) and surfaces the first two, so you can spot when an employer or institution is browsing. It is a strong hint, not a guarantee, many people browse from home over a consumer ISP, which shows only the ISP.

### Test the Functions locally (optional)
```bash
npm run build                                              # build first
npx wrangler d1 execute site-analytics --local --file=./schema.sql   # seed a local db
echo "ADMIN_PASSWORD=test" > .dev.vars
npx wrangler pages dev dist                                # static site + Functions + local DB
# then visit the printed localhost URL; /insights uses admin / test
```

## 8. Continuous integration (CI)

`.github/workflows/ci.yml` runs the responsive test suite (section 5) on **every push to `main` and every pull request**. It installs dependencies, builds the site, and runs the Playwright tests across all four device viewports. If any layout breaks, the check fails (red X on the commit/PR), and the run uploads a **`playwright-report` artifact** containing the per-device screenshots and any failure traces, so you can see exactly what broke and on which device.

This is independent of deployment: Cloudflare Pages still deploys from `main` on its own. CI is just a safety net that flags broken layouts before (or right as) they ship. If you want deploys to wait for tests to pass, you can later add the CI check as a required status check in your GitHub branch protection settings.

---

## Project layout

```
src/
  content/posts/    Blog posts (Markdown). One file per project.
  pages/            Routes: index, projects (redirect), cv, post/[id], 404, og/ (social cards)
  components/       Header, Footer, Starfield, ProjectCard, SatMap, Socials
  layouts/          Base (shared shell) and Post
  lib/og.ts         Open Graph social-card image template (satori)
  styles/global.css Design tokens plus all shared styling
public/
  media/            Images, videos, post covers, award logos, profile photo
  files/            CV PDF and other downloadable documents
  satmap.html       Self-contained CesiumJS satellite globe (loaded in an iframe)
tests/              Playwright responsive/cross-device tests
playwright.config.ts  Test viewports (mobile/tablet/desktop) + dev server config
.github/workflows/  CI: runs the responsive tests on every push and pull request
functions/          Cloudflare Pages Functions: track.js (beacon), insights.js (dashboard), oembed.js
wrangler.toml       Cloudflare config (D1 binding)
schema.sql          Analytics database schema
scrape/, site_files/  Local archives from the old Wix site (gitignored, reference only)
```

See `CLAUDE.md` for deeper conventions.
