import { test, expect } from '@playwright/test';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

// Guards the vendored PDF.js copy in public/pdfjs/ (the CV page's embed).
//
// No browser and no build: these are assertions about the files on disk, which
// is the only way to catch this particular failure. PDF.js ships two dists, and
// the difference between them is invisible to a layout test:
//
//   * the default build is emitted untranspiled and unpolyfilled, "intended for
//     the latest browsers" -- it is what was vendored here originally, and it
//     never started in iOS WebKit, leaving a blank box on phones while every
//     desktop browser was fine;
//   * the legacy build is transpiled and bundles core-js polyfills, and is the
//     one Mozilla documents as supporting Safari 18+.
//
// Playwright's own WebKit always tracks the newest Safari, so a browser test
// cannot tell them apart either. Pinning it here is what keeps the next
// re-vendor from quietly shipping the blank box again.

const PDFJS = join(process.cwd(), 'public/pdfjs');

const BUNDLES = [
  'build/pdf.mjs',
  'build/pdf.worker.mjs',
  'web/viewer.mjs',
];

test.describe('vendored PDF.js', () => {
  for (const rel of BUNDLES) {
    test(`${rel} is the legacy (transpiled + polyfilled) build`, () => {
      const path = join(PDFJS, rel);
      expect(existsSync(path), `${rel} is missing from public/pdfjs/`).toBe(true);

      // core-js is bundled only into the legacy dist; the default dist has no
      // trace of it. Re-vendor from pdfjs-<version>-legacy-dist.zip, not
      // pdfjs-<version>-dist.zip.
      const src = readFileSync(path, 'utf8');
      expect(
        src.includes('core-js'),
        `${rel} looks like PDF.js's default build, which does not run on iOS. ` +
          'Re-vendor it from the -legacy-dist release archive.',
      ).toBe(true);
    });
  }

  // The viewer fetches these at runtime and swallows the failure when they are
  // absent, so a missing directory shows up only as a broken render. wasm/ was
  // left out once (every CV view logged a WebAssembly CompileError) and iccs/
  // was left out again (colour profile 404, CMYK fell back).
  const REQUIRED_ASSETS = [
    'web/wasm/qcms_bg.wasm',
    'web/wasm/jbig2.wasm',
    'web/wasm/openjpeg.wasm',
    'web/iccs/CGATS001Compat-v2-micro.icc',
    'web/standard_fonts',
    'web/images',
    'web/viewer.html',
    'web/viewer.css',
  ];

  for (const rel of REQUIRED_ASSETS) {
    test(`${rel} is vendored`, () => {
      expect(
        existsSync(join(PDFJS, rel)),
        `public/pdfjs/${rel} is missing; the viewer fetches it on demand and fails silently without it`,
      ).toBe(true);
    });
  }

  test('quickjs-eval.wasm stays out', () => {
    // Deliberately omitted: it exists only to execute JavaScript embedded in a
    // PDF, which this site never wants to run.
    expect(existsSync(join(PDFJS, 'web/wasm/quickjs-eval.wasm'))).toBe(false);
  });

  test('the viewer and the API bundle are the same PDF.js version', () => {
    const version = (rel: string) =>
      readFileSync(join(PDFJS, rel), 'utf8').match(/"(\d+\.\d+\.\d+)"/)?.[1];
    expect(version('build/pdf.mjs')).toBeTruthy();
    expect(version('build/pdf.worker.mjs')).toBe(version('build/pdf.mjs'));
  });
});
