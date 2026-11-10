// Writes the brand sources from final.params.mjs (the only source of the final logo):
//   web/brand/*.svg, the marked block in web/src/ui/Logo.tsx, the splash in web/index.html.
// Then render the rasters: cd web && npx tauri icon brand/app-icon.svg && npm run gen:icons
//
//   node export.mjs            (needs `cd web && npm ci` for Playwright's Chromium: the export verifies
//                               every written file against the master by rendering both)
//
// Structure shared by every file that draws the fish (brand-sync.test.ts enforces it): two paths –
// `body`, and `tail` = caudal fin + dorsal + ventral fin (one path, they do not overlap) – drawn in one
// fill with a same-colour stroke (corner rounding) under a mask that cuts the two bands and the eye.
// Both bands are stroked with one width (the narrower one); the wider band is two offset strokes, so
// the React `Logo` (one stroke width constant) draws the same shape as the master.
// With `stripes.rim` the bands are cut inside the body only (clip path = `body`) and a white stroke of
// that width on the body outline puts the rim back: the fish stays one piece.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { COLORS, VIEWS, buildLayers, markGeometry, merge } from './mark.mjs';
import { lockupSvg } from './wordmark.mjs';
import { ADAPTIVE_SAFE_RADIUS, LOCKUP, MARK, MASKABLE_SAFE_RADIUS, WORD, WORDMARK_BOX } from './final.params.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const web = resolve(here, '../../web');
const r1 = (n) => Math.round(n * 10) / 10;
const r3 = (n) => Math.round(n * 1000) / 1000;

// ---- tokens: the logo colour is the accent token --------------------------------------------
const tokens = readFileSync(join(web, 'src/ui/tokens.css'), 'utf8');
const hexes = (name) => [...tokens.matchAll(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{6})`, 'g'))].map((m) => m[1].toLowerCase());
const [accentLight, accentDark] = hexes('--accent');
const [contrastLight, contrastDark] = hexes('--accent-contrast');
for (const [what, got, want] of [
  ['--accent (light)', accentLight, COLORS.accent.light],
  ['--accent (dark)', accentDark, COLORS.accent.dark],
  ['--accent-contrast (light)', contrastLight, COLORS.accentContrast.light],
  ['--accent-contrast (dark)', contrastDark, COLORS.accentContrast.dark],
]) {
  if (got !== want) throw new Error(`tokens.css ${what} is ${got}, the master has ${want}: update COLORS in mark.mjs and re-export`);
}
const ACCENT = COLORS.accent;
const CONTRAST = COLORS.accentContrast;
const WHITE = '#ffffff';

// ---- geometry ------------------------------------------------------------------------------
const g = markGeometry(MARK.params);
const views = merge(VIEWS, MARK.params.views ?? {});
const tailD = g.rest.join(''); // tail + fins as sub-paths of one path
const base = Math.min(...g.cuts.map((c) => c.w)); // LOGO_CUT_WIDTH

/** Applies fn(x, y) to every coordinate pair of an absolute M/L/C/Q/Z path. */
function mapPairs(d, fn) {
  const out = [];
  let pair = [];
  for (const [, cmd, num] of d.matchAll(/([MLCQZ])|(-?\d*\.?\d+)/g)) {
    if (cmd) {
      out.push(cmd);
      continue;
    }
    pair.push(Number(num));
    if (pair.length === 2) {
      const [x, y] = fn(pair);
      out.push(`${r1(x)} ${r1(y)}`);
      pair = [];
    }
  }
  return out.join(' ').replace(/([MLCQZ]) /g, '$1').replace(/ ([MLCQZ])/g, '$1');
}
/** One stroke of width `base` for a band of that width, two offset strokes for a wider band. */
function bandPath(cut) {
  const off = (cut.w - base) / 2;
  if (off === 0) return cut.d;
  if (off > base / 2) throw new Error('a band more than twice as wide as the narrowest needs more offset strokes');
  return mapPairs(cut.d, ([x, y]) => [x - off, y]) + mapPairs(cut.d, ([x, y]) => [x + off, y]);
}
const [cut1, cut2] = g.cuts.map(bandPath);
const { cx, cy, r } = g.eye;

const RIM = g.rim;
/** Clip path of the body: keeps the cut bands inside it, so a rim of the fish stays. */
const bodyClip = (id, indent = '    ') =>
  `<clipPath id="${id}-b">
${indent}  <path d="${g.body}"/>
${indent}</clipPath>`;
const mask = (id, indent = '    ') =>
  `${RIM > 0 ? `${bodyClip(id, indent)}\n${indent}` : ''}<mask id="${id}" maskUnits="userSpaceOnUse" x="-512" y="-512" width="1536" height="1536">
${indent}  <rect x="-512" y="-512" width="1536" height="1536" fill="#fff"/>
${indent}  <g fill="none" stroke="#000"${RIM > 0 ? ` clip-path="url(#${id}-b)"` : ''}>
${indent}    <path d="${cut1}" stroke-width="${base}"/>
${indent}    <path d="${cut2}" stroke-width="${base}"/>
${indent}  </g>${RIM > 0 ? `\n${indent}  <path d="${g.body}" fill="none" stroke="#fff" stroke-width="${RIM}" stroke-linejoin="round"/>` : ''}
${indent}  <circle cx="${cx}" cy="${cy}" r="${r}" fill="#000"/>
${indent}</mask>`;
/** The fish with the bands and the eye cut out; the stroke in the same colour rounds the corners. */
const fish = (color, id, indent = '  ') =>
  `${indent}<g fill="${color}" stroke="${color}" stroke-width="${g.soften}" stroke-linejoin="round" mask="url(#${id})">
${indent}  <path d="${g.body}"/>
${indent}  <path d="${tailD}"/>
${indent}</g>`;
const svg = (viewBox, inner, label = true) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${viewBox}"${label ? ' role="img" aria-label="Nemo"' : ''}>\n${inner}\n</svg>\n`;
/** translate + scale that equals "scale s around (256,256), then move by (dx, dy)". */
const place = (s, dx = 0, dy = 0) => `translate(${r3(256 * (1 - s) + dx)} ${r3(256 * (1 - s) + dy)}) scale(${s})`;

// Tight view box around the fish; square box for the one-colour file.
const b = g.box;
const tight = [Math.floor(b.x), Math.floor(b.y), Math.ceil(b.w) + 1, Math.ceil(b.h) + 1];
const side = Math.ceil(Math.max(b.w, b.h) * 1.08);
const square = [r1(b.x + b.w / 2 - side / 2), r1(b.y + b.h / 2 - side / 2), side, side];

// ---- guards -----------------------------------------------------------------------------------
const tile = views.tile;
const ad = views.adaptive;
if (g.radius(ad.scale, ad.dx ?? 0, ad.dy ?? 0) > ADAPTIVE_SAFE_RADIUS) throw new Error('the adaptive layer leaves the 66 dp safe zone');
// The fish's box is not centred in the canvas: the maskable icon centres it before scaling into the safe circle.
const offCentre = b.x + b.w / 2 - 256;
const maskable = Math.min(1, MASKABLE_SAFE_RADIUS / g.radius(1, -offCentre, 0));

// ---- files ---------------------------------------------------------------------------------------
const files = {};
files['logo-mark.svg'] = svg(
  tight.join(' '),
  `  <!-- Nemo mark: one fill, bands and eye are cut out (mask) so it sits on any background. -->
  <defs>
    ${mask('nemo-mark-cut')}
  </defs>
${fish(ACCENT.light, 'nemo-mark-cut')}`,
);
files['logo-mono.svg'] = svg(
  square.join(' '),
  `  <defs>
    ${mask('nemo-mono-cut')}
  </defs>
${fish('#000', 'nemo-mono-cut')}`,
);
files['app-icon.svg'] = svg(
  '0 0 512 512',
  `  <defs>
    ${mask('nemo-app-cut')}
  </defs>
  <rect width="512" height="512" rx="${tile.radius}" fill="${ACCENT.light}"/>
  <g transform="${place(tile.scale, tile.dx ?? 0, tile.dy ?? 0)}">
${fish(WHITE, 'nemo-app-cut', '    ')}
  </g>`,
);
files['app-icon-maskable.svg'] = svg(
  '0 0 512 512',
  `  <defs>
    ${mask('nemo-maskable-cut')}
  </defs>
  <rect width="512" height="512" fill="${ACCENT.light}"/>
  <g transform="${place(r3(maskable), r3(-offCentre * maskable))}">
${fish(WHITE, 'nemo-maskable-cut', '    ')}
  </g>`,
);
files['android-foreground.svg'] = svg(
  '0 0 512 512',
  `  <defs>
    ${mask('nemo-fg-cut')}
  </defs>
  <g transform="${place(ad.scale, ad.dx ?? 0, ad.dy ?? 0)}">
${fish(WHITE, 'nemo-fg-cut', '    ')}
  </g>`,
  false,
);
files['android-monochrome.svg'] = svg(
  '0 0 512 512',
  `  <defs>
    ${mask('nemo-monochrome-cut')}
  </defs>
  <g transform="${place(ad.scale, ad.dx ?? 0, ad.dy ?? 0)}">
${fish('#fff', 'nemo-monochrome-cut', '    ')}
  </g>`,
  false,
);

// Wordmark: the pill (mark + NEMO). The file keeps the old wordmark's aspect ratio (1368:401) with the pill
// left-aligned at 36 of the 44 px head, so `ui/Wordmark.tsx` and the sidebar need no change.
function wordmark(theme, { responsive }) {
  const colors = responsive ? { pill: 'var(--pill)', ink: 'var(--ink)' } : { pill: ACCENT[theme], ink: CONTRAST[theme] };
  const layers = buildLayers(MARK.params, { id: responsive ? 'nemo-wordmark' : 'nemo-wordmark-light' });
  const l = lockupSvg(layers, WORD, { ...LOCKUP, colors, margin: 0 }, theme);
  const hPill = 36; // PLACEMENT.sidebarWide.pill
  const H = (l.pill.h * WORDMARK_BOX.headPx) / hPill;
  const W = H * WORDMARK_BOX.aspect;
  if (l.pill.w > W) throw new Error(`the pill (${r1(l.pill.w)}) is wider than the 1368:401 box (${r1(W)}): shorten the lockup`);
  const vb = [l.pill.x, l.pill.y - (H - l.pill.h) / 2, W, H].map((n) => r3(n));
  const style = responsive
    ? `\n  <style>svg{--pill:${ACCENT.light};--ink:${CONTRAST.light}}@media (prefers-color-scheme:dark){svg{--pill:${ACCENT.dark};--ink:${CONTRAST.dark}}}</style>`
    : '';
  const note = responsive
    ? '<!-- Nemo wordmark: mark + NEMO on the accent pill; follows the system colour scheme (accent token light/dark). Left-aligned in a 1368:401 box. -->'
    : '<!-- Nemo wordmark for dark surfaces (README banner on the ocean gradient): the dark-theme accent token. -->';
  return svg(vb.join(' '), `  ${note}${style}\n  ${l.body}`);
}
files['logo-wordmark.svg'] = wordmark('light', { responsive: true });
files['logo-wordmark-light.svg'] = wordmark('dark', { responsive: false });

// ---- verify against the master by rendering both -------------------------------------------------
const require = createRequire(import.meta.url);
const { chromium } = require(join(web, 'node_modules/@playwright/test'));
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' });
const page = await browser.newPage();
await page.setContent('<canvas id=c></canvas>');
async function diff(a, b, size = 512) {
  return page.evaluate(
    async ([a, b, size]) => {
      const load = (s) =>
        new Promise((res, rej) => {
          const i = new Image();
          i.onload = () => res(i);
          i.onerror = rej;
          i.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(s)}`;
        });
      const px = async (s) => {
        const img = await load(s);
        const c = document.createElement('canvas');
        c.width = size;
        c.height = size;
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#808080'; // compare what is seen: transparent pixels carry no colour
        ctx.fillRect(0, 0, size, size);
        ctx.drawImage(img, 0, 0, size, size);
        return ctx.getImageData(0, 0, size, size).data;
      };
      const A = await px(a);
      const B = await px(b);
      let max = 0;
      let bad = 0;
      for (let i = 0; i < A.length; i++) {
        const d = Math.abs(A[i] - B[i]);
        if (d > max) max = d;
        if (d > 48) bad++;
      }
      return { max, bad };
    },
    [a, b, size],
  );
}
const master = buildLayers(MARK.params, { ink: { mark: ACCENT.light, onTile: WHITE, tile: ACCENT.light, mono: '#000000' } });
const checks = [
  ['logo-mark.svg', files['logo-mark.svg'], master.mark],
  ['app-icon.svg', files['app-icon.svg'], master.app],
  ['android-foreground.svg', files['android-foreground.svg'], master.adFg],
  ['android-monochrome.svg', files['android-monochrome.svg'], master.adMono],
];
for (const [name, ours, theirs] of checks) {
  const d = await diff(ours, theirs);
  console.log(`verify ${name}: max channel difference ${d.max}, channel values off by more than 48: ${d.bad}`);
  if (d.bad > 0) throw new Error(`${name} differs from the master`);
}
await browser.close();

// ---- write -----------------------------------------------------------------------------------------
mkdirSync(join(web, 'brand'), { recursive: true });
for (const [name, text] of Object.entries(files)) writeFileSync(join(web, 'brand', name), text);

const block = `// brand:begin (generated by design/logo-v2/export.mjs – do not edit by hand)
export const LOGO_PATHS = {
  body: '${g.body}',
  /** Caudal fin plus the dorsal and the ventral fin: one path (they do not overlap). */
  tail: '${tailD}',
  cut1: '${cut1}',
  /** The wider band is two offset strokes, so one stroke width serves both bands. */
  cut2: '${cut2}',
} as const;
/** Band width (the narrower band), eye and corner rounding of the mark, in the same 512 canvas as the paths. */
export const LOGO_CUT_WIDTH = ${base};
export const LOGO_EYE = { cx: ${cx}, cy: ${cy}, r: ${r} } as const;
export const LOGO_SOFTEN = ${g.soften};
/** The bands are cut inside the body only; a stroke of this width on the body outline keeps the rim (0 = bands cut through). */
export const LOGO_RIM = ${RIM};
/** The mark follows the accent token (and "Logo in Themenfarbe" via \`--logo-ink\`). */
export const LOGO_COLOR = 'var(--accent)';
/** The accent token's two values (tokens.css \`--accent\`, light and dark) that the static brand files use. */
export const LOGO_ACCENT = { light: '${ACCENT.light}', dark: '${ACCENT.dark}' } as const;
/** Bounding box of the fish inside the 512 canvas. */
export const LOGO_VIEWBOX = '${tight.join(' ')}';
export const LOGO_ASPECT = ${r3(tight[2] / tight[3])};
// brand:end`;
const replaceBlock = (file, re, text) => {
  const path = join(web, file);
  const src = readFileSync(path, 'utf8');
  if (!re.test(src)) throw new Error(`markers missing in ${file}`);
  writeFileSync(path, src.replace(re, () => text));
};
replaceBlock('src/ui/Logo.tsx', /\/\/ brand:begin[\s\S]*?\/\/ brand:end/, block);

const splash = `<!-- brand:begin -->
      <svg viewBox="${tight.join(' ')}" focusable="false">
        <defs>
          ${mask('sp', '          ')}
        </defs>
        <g fill="var(--accent, ${ACCENT.light})" stroke="var(--accent, ${ACCENT.light})" stroke-width="${g.soften}" stroke-linejoin="round" mask="url(#sp)">
          <path d="${g.body}" />
          <path d="${tailD}" />
        </g>
      </svg>
      <!-- brand:end -->`;
replaceBlock('index.html', /<!-- brand:begin -->[\s\S]*?<!-- brand:end -->/, splash);

console.log(`brand sources written; fish view box ${tight.join(' ')}, maskable scale ${r3(maskable)}, adaptive radius ${r1(g.radius(ad.scale, ad.dx ?? 0, ad.dy ?? 0))} of ${ADAPTIVE_SAFE_RADIUS}`);
console.log(`wordmark box ${files['logo-wordmark.svg'].match(/viewBox="([^"]+)"/)[1]}`);
