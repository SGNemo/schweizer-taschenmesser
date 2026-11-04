// Contrast and hue-distance matrix for the module palette (identity v3 audit). Reads web/src/ui/tokens.css.
import { readFileSync } from 'node:fs';
const css = readFileSync(process.argv[2] ?? 'src/ui/tokens.css', 'utf8');
const block = (start) => {
  const i = css.indexOf(start);
  let depth = 0, j = css.indexOf('{', i);
  for (let k = j; k < css.length; k++) { if (css[k] === '{') depth++; else if (css[k] === '}') { depth--; if (!depth) return css.slice(j, k); } }
  return '';
};
const vars = (txt) => Object.fromEntries([...txt.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\b/g)].map((m) => [m[1], m[2]]));
const light = vars(block(':root {'));
const dark = vars(block(":root[data-theme='dark'] {"));
const hex = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const toHex = (rgb) => '#' + rgb.map((v) => Math.round(v).toString(16).padStart(2, '0')).join('');
const mix = (a, pct, b) => toHex(hex(a).map((v, i) => v * pct / 100 + hex(b)[i] * (1 - pct / 100)));
const lum = (h) => { const [r, g, b] = hex(h).map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
const cr = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return ((x + 0.05) / (y + 0.05)); };
const hue = (h) => { const [r, g, b] = hex(h).map((v) => v / 255); const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min; if (!d) return NaN; let H = max === r ? ((g - b) / d) % 6 : max === g ? (b - r) / d + 2 : (r - g) / d + 4; H *= 60; return (H + 360) % 360; };
const dist = (a, b) => { const d = Math.abs(a - b) % 360; return d > 180 ? 360 - d : d; };
const HUES = ['lime', 'moss', 'fern', 'teal', 'ocean', 'sky', 'cobalt', 'indigo', 'violet', 'orchid', 'slate'];
const f = (n) => n.toFixed(1).padStart(5);
for (const [name, t] of [['light', light], ['dark', dark]]) {
  const ink = name === 'light' ? t.surface : t.bg;
  console.log(`\n## ${name}  (hue on bg/surface/surface-2 ≥3:1 · plate ink on hue ≥3:1 · text on tints ≥4.5:1 · hue as icon on tints ≥3:1)`);
  console.log('hue      | H°   | on bg | on sf | on sf2| ink/hue | text@40%| text@14%| muted@40%| muted@14%| t3@14% | hue@18% | hue@12% | hue@5%');
  for (const h of HUES) {
    const c = t[`mod-${h}`];
    const head40 = mix(c, 40, t.surface), w14 = mix(c, 14, t.surface), t18 = mix(c, 18, t.surface), t12 = mix(c, 12, t.surface), t5 = mix(c, 5, t.surface);
    console.log(`${h.padEnd(8)} | ${String(Math.round(hue(c))).padStart(4)} | ${f(cr(c, t.bg))} | ${f(cr(c, t.surface))} | ${f(cr(c, t['surface-2']))} | ${f(cr(ink, c))}   | ${f(cr(t.text, head40))}   | ${f(cr(t.text, w14))}   | ${f(cr(t['text-muted'], head40))}    | ${f(cr(t['text-muted'], w14))}    | ${f(cr(t['text-3'], w14))}  | ${f(cr(c, t18))}   | ${f(cr(c, t12))}   | ${f(cr(c, t5))}`);
  }
  console.log('\nhue distance (°) to state colours (≥25 wanted):');
  const states = ['danger', 'warning', 'success', 'info', 'accent', 'focus'];
  console.log('hue      | ' + states.map((s) => `${s}(${Math.round(hue(t[s]))})`.padStart(12)).join(' | '));
  for (const h of HUES.filter((x) => x !== 'slate')) {
    const H = hue(t[`mod-${h}`]);
    console.log(`${h.padEnd(8)} | ` + states.map((s) => String(Math.round(dist(H, hue(t[s])))).padStart(12)).join(' | '));
  }
  console.log('\narea colour vs the hues of its modules (°):');
  const areas = { plan: ['cat-1', ['sky', 'moss', 'violet', 'teal', 'cobalt', 'ocean', 'orchid']], money: ['cat-2', ['teal', 'ocean', 'indigo', 'lime']], household: ['cat-4', ['orchid', 'fern']], knowledge: ['cat-3', ['indigo', 'violet', 'sky', 'cobalt', 'moss', 'teal', 'orchid']], vault: ['cat-5', ['indigo', 'slate']], system: ['cat-6', ['slate', 'cobalt']] };
  for (const [a, [cat, hs]] of Object.entries(areas)) {
    const H = hue(t[cat]);
    console.log(`${a.padEnd(10)} ${cat}(${Math.round(H)}°): ` + hs.map((h) => `${h} ${Math.round(dist(H, hue(t[`mod-${h}`])))}°`).join(', '));
  }
  console.log('\ncalm: text-3 as module colour → ink on plate', f(cr(ink, t['text-3'])), '· text on 12% tint', f(cr(t.text, mix(t['text-3'], 12, t.surface))));
}
