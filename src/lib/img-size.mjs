// Build-time helper: give every <img> in a rendered post that points at a file
// in public/ explicit width/height attributes (read from the file) so the
// browser reserves the right box before the image loads. Markdown images carry
// no intrinsic size, and without one each image pushed the text below it down
// as it arrived (layout shift, CLS) on every post page. Used by Post.astro on
// the rendered slot HTML, so it needs no Markdown-pipeline plugins.
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import sharp from 'sharp';

const PUBLIC = join(process.cwd(), 'public');
const cache = new Map();

function dimensions(src) {
  if (!cache.has(src)) {
    const file = join(PUBLIC, src);
    cache.set(
      src,
      existsSync(file)
        ? sharp(file)
            .metadata()
            .then((m) => {
              // EXIF orientation 5-8 means the stored pixels are rotated 90deg.
              const swap = m.orientation && m.orientation >= 5;
              return swap ? { width: m.height, height: m.width } : { width: m.width, height: m.height };
            })
            .catch(() => null)
        : Promise.resolve(null),
    );
  }
  return cache.get(src);
}

// Autoplaying post videos are multi-megabyte and usually far below the fold,
// yet `autoplay` (and preload="auto") makes the browser start downloading
// them as soon as the tag is parsed, ahead of the images the visitor can
// actually see. Rewrite them to data-autoplay + preload="none" in the HTML;
// the post layout script plays/pauses them as they scroll into/out of view.
/**
 * Intrinsic size of a file in public/, for markup built outside the post
 * pipeline (award and org logos, which are hand-written <img> tags in Astro
 * components). Returns null when the file is missing, so callers can render
 * without the attributes rather than fail the build.
 */
export async function imgSize(src) {
  return (await dimensions(src)) ?? null;
}

export function deferAutoplayVideos(html) {
  return html.replace(/<video\b[^>]*\sautoplay(?:="[^"]*")?[^>]*>/g, (tag) =>
    tag
      .replace(/\sautoplay(?:="[^"]*")?/, ' data-autoplay')
      .replace(/\spreload="[^"]*"/, '')
      .replace(/^<video/, '<video preload="none"'),
  );
}

export async function addImgSizes(html) {
  const tags = [...html.matchAll(/<img\b[^>]*>/g)];
  const out = await Promise.all(
    tags.map(async ([tag], i) => {
      // Markdown images have no loading hint, so a post used to fetch every
      // image at once and the visible ones queued behind the rest. Lazy-load
      // all but the first (the one most likely above the fold), unless the
      // author set loading= explicitly.
      const extra = [];
      if (i > 0 && !/\sloading=/.test(tag)) extra.push('loading="lazy"', 'decoding="async"');
      if (!(/\swidth=/.test(tag) && /\sheight=/.test(tag))) {
        const m = tag.match(/\ssrc="(\/[^"/][^"]*)"/);
        const d = m ? await dimensions(m[1]) : null;
        if (d && d.width && d.height) extra.push(`width="${d.width}"`, `height="${d.height}"`);
      }
      if (!extra.length) return tag;
      return tag.replace(/\s*\/?>$/, (end) => ' ' + extra.join(' ') + end);
    }),
  );
  let i = 0;
  return html.replace(/<img\b[^>]*>/g, () => out[i++]);
}
