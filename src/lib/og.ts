// Build-time Open Graph / social-card image generator.
// Renders a consistent, branded 1200x630 PNG per page (profile photo + a short
// "gist" of the page) using satori (layout -> SVG) and resvg (SVG -> PNG).
import satori from 'satori';
import { Resvg } from '@resvg/resvg-js';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.cwd();
const read = (p: string) => readFileSync(join(root, p));

// satori needs ttf/otf/woff (NOT woff2); @fontsource ships matching .woff files.
const fonts = [
  { name: 'Sora', weight: 700 as const, style: 'normal' as const, data: read('node_modules/@fontsource/sora/files/sora-latin-700-normal.woff') },
  { name: 'Sora', weight: 600 as const, style: 'normal' as const, data: read('node_modules/@fontsource/sora/files/sora-latin-600-normal.woff') },
  { name: 'Mono', weight: 400 as const, style: 'normal' as const, data: read('node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-400-normal.woff') },
  { name: 'Mono', weight: 600 as const, style: 'normal' as const, data: read('node_modules/@fontsource/ibm-plex-mono/files/ibm-plex-mono-latin-600-normal.woff') },
];

const profileUri = `data:image/jpeg;base64,${read('public/media/profile.jpg').toString('base64')}`;

type Node = { type: string; props: Record<string, unknown> };
type Child = Node | string;

function h(type: string, style: Record<string, unknown>, children?: Child | Child[]): Node {
  return { type, props: { style, children } };
}

export interface OgContent {
  kicker: string;
  title: string;
  summary: string;
}

const TEAL = '#5eead4';
const INK = '#e8eef9';
const MUTED = '#aab8d4';
const DIM = '#6f7fa0';

function card({ kicker, title, summary }: OgContent): Node {
  return h(
    'div',
    {
      width: '1200px',
      height: '630px',
      display: 'flex',
      flexDirection: 'row',
      padding: '72px',
      background: '#05080f',
      backgroundImage: 'radial-gradient(120% 90% at 16% -25%, rgba(56,89,153,0.5), transparent 60%)',
      fontFamily: 'Sora',
    },
    [
      // Left: textual gist of the page.
      h(
        'div',
        { display: 'flex', flexDirection: 'column', flex: 1, justifyContent: 'space-between', paddingRight: '52px' },
        [
          h('div', { display: 'flex', flexDirection: 'column' }, [
            h(
              'div',
              { display: 'flex', fontFamily: 'Mono', fontSize: '24px', letterSpacing: '5px', color: TEAL, textTransform: 'uppercase' },
              kicker,
            ),
            h(
              'div',
              { display: 'flex', fontFamily: 'Sora', fontWeight: 700, fontSize: '58px', lineHeight: 1.07, color: INK, marginTop: '26px', lineClamp: 3 },
              title,
            ),
            h(
              'div',
              { display: 'flex', fontFamily: 'Mono', fontSize: '27px', lineHeight: 1.45, color: MUTED, marginTop: '28px', lineClamp: 3 },
              summary,
            ),
          ]),
          // Footer: site domain.
          h('div', { display: 'flex', alignItems: 'center', marginTop: '40px' }, [
            h('div', { display: 'flex', width: '14px', height: '14px', borderRadius: '9999px', background: TEAL, marginRight: '14px' }),
            h('div', { display: 'flex', fontFamily: 'Mono', fontWeight: 600, fontSize: '26px', color: INK }, 'atillasaadat.me'),
          ]),
        ],
      ),
      // Right: profile photo as a HUD-style ID card, matching the homepage hero.
      h('div', { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }, [
        h(
          'div',
          { display: 'flex', width: '424px', height: '283px', borderRadius: '16px', overflow: 'hidden', border: `2px solid rgba(126,168,255,0.4)` },
          [{ type: 'img', props: { src: profileUri, width: 424, height: 283, style: { objectFit: 'cover' } } }],
        ),
        h(
          'div',
          { display: 'flex', fontFamily: 'Mono', fontSize: '20px', letterSpacing: '3px', color: DIM, marginTop: '22px' },
          'SAADAT, ATILLA',
        ),
      ]),
    ],
  );
}

export async function ogPng(content: OgContent): Promise<Buffer> {
  const svg = await satori(card(content) as unknown as object, { width: 1200, height: 630, fonts });
  return new Resvg(svg, { background: '#05080f' }).render().asPng();
}
