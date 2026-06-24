# Product

## Register

brand

## Users

Recruiters, hiring managers, and PhD admissions committees in the aerospace and tech space. They arrive from LinkedIn, a referral, a paper, or a CV link, usually skimming under time pressure and often on mobile. Their job to be done: decide, quickly and with confidence, whether Atilla Saadat is a credible, exceptional spacecraft GNC engineer and researcher worth contacting, hiring, or admitting. They want proof (papers, results, real hardware, awards), not adjectives.

## Product Purpose

A personal portfolio and project/research blog for Atilla Saadat, Spacecraft GNC Engineer II at Varda Space Industries and M.S. CS student at Georgia Tech. It showcases engineering projects, peer-reviewed research, patents, awards, and CV, and replaces a previous Wix site (inbound links and old post slugs must be preserved). Success: a reviewer leaves convinced of technical depth and reaches out, while the site stays fast, responsive, and well-indexed. A private `/insights` analytics dashboard exists but is utility-only and not the design focus.

## Brand Personality

Precise, technical, mission-control. The voice is confident, exact, and understated; it reads like an engineering research profile crossed with a flight-operations console. Three words: precise, technical, mission-control. Emotional goal: earned trust. The reader should feel they are looking at the work of someone rigorous and proven, not someone marketing themselves.

## Anti-references

- **Over-animated / flashy** (the explicit no): parallax on everything, motion for its own sake, scroll-jacking, slow decorative effects. Motion must serve comprehension or it does not ship.
- Generic dev-portfolio template ("hi, I'm X, here are my skill bars").
- Corporate SaaS landing tropes: gradient blobs, the hero-metric template, endless identical card grids.
- A plain unstyled academic CV wall-of-text with no visual identity.

## Design Principles

1. **Substance over spectacle.** The work, results, and real artifacts (papers, DOIs, hardware photos, flight data) lead. Effects and motion appear only when they clarify or guide.
2. **Engineer's credibility.** Precision in every detail: exact numbers, correct units, real citations, consistent terminology. Nothing approximate or decorative-but-false.
3. **Performance and SEO are features.** Never trade load time, responsiveness, or crawlability for decoration. Astro zero-JS-by-default, lazy media, preserved slugs.
4. **Mission-control coherence.** One dark HUD/telemetry design system (corner-bracket cards, mono micro-labels, telemetry-teal accent) so every page reads like the same instrument.
5. **Respect the reader's time.** Scannable hierarchy: a busy reviewer gets the gist in seconds and depth on demand. Lead with the result, support with the method.

## Accessibility & Inclusion

Target WCAG 2.1 AA: body text contrast >= 4.5:1, large text >= 3:1, visible keyboard focus, semantic landmarks and headings. Full `prefers-reduced-motion` support (every animation has a crossfade or instant fallback). Fully responsive across mobile, tablet, and desktop (the old Wix site had mobile rendering problems; this is a hard requirement). External links open safely with `rel="noopener"`.
