import { test, expect } from '@playwright/test';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

// Astro's compressHTML drops the line break between a word and an inline
// element that starts the next source line, without leaving a space:
//
//   ...where they need to go. At
//   <a href="...">Varda Space Industries</a>
//   in Los Angeles
//
// ships as "AtVarda Space Industriesin Los Angeles". Keep the neighbouring word
// on the element's line ("At <a ...>...</a> in"). This scans the built output
// (the webServer step builds it) so every page is covered, not just PAGES.

const INLINE = 'a|strong|em|b|i|code|abbr|time|sup|small|mark|kbd';
const GLUED = new RegExp(
  `[A-Za-z0-9,.:;!?)]<(?:${INLINE})(?:\\s[^>]*)?>|</(?:${INLINE})>[A-Za-z0-9(]`,
  'g',
);

function htmlFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = join(dir, e.name);
    if (e.isDirectory()) return e.name === 'pdfjs' ? [] : htmlFiles(p);
    return e.name.endsWith('.html') ? [p] : [];
  });
}

test('no word is glued to a link or inline element', async ({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'scans build output; once is enough');

  const hits: string[] = [];
  for (const file of htmlFiles('dist')) {
    const html = readFileSync(file, 'utf8')
      .replace(/<script[\s\S]*?<\/script>/g, '')
      .replace(/<style[\s\S]*?<\/style>/g, '');
    for (const m of html.matchAll(GLUED)) {
      const i = m.index ?? 0;
      hits.push(`${file}: …${html.slice(Math.max(0, i - 30), i + 40).replace(/\s+/g, ' ')}…`);
    }
  }
  expect(hits, `text runs into an inline element (missing space):\n${hits.join('\n')}`).toEqual([]);
});
