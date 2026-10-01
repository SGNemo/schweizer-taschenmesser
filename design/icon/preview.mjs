// Quick contact strip while tuning: node preview.mjs <round> -> rounds/<round>/_contact.png (not committed)
import { writeFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Resvg } from '@resvg/resvg-js';
import { buildLayers } from './fish.mjs';
const here = dirname(fileURLToPath(import.meta.url));
const r = process.argv[2];
const dir = existsSync(join(here, 'rounds', r)) ? join(here, 'rounds', r) : join(here, 'rounds', 'archive', r);
const out = process.argv[3] ?? join(dir, '_contact.png');
const spec = (await import(pathToFileURL(join(dir, 'variants.mjs')).href)).default;
const vs = spec.variants.filter((v) => v.params);
const b64 = (s) => Buffer.from(s).toString('base64');
let body = '';
vs.forEach((v, i) => {
  const L = buildLayers(v.params);
  const x = i * 560;
  body += `<rect x="${x}" width="540" height="820" fill="#fff"/><image x="${x + 14}" y="14" width="256" height="256" href="data:image/svg+xml;base64,${b64(L.full)}"/>`;
  body += `<image x="${x + 280}" y="14" width="256" height="256" href="data:image/svg+xml;base64,${b64(L.mark)}"/>`;
  body += `<rect x="${x}" y="280" width="540" height="270" fill="#222"/><image x="${x + 14}" y="287" width="256" height="256" href="data:image/svg+xml;base64,${b64(L.adBg)}"/><image x="${x + 14}" y="287" width="256" height="256" href="data:image/svg+xml;base64,${b64(L.adFg)}"/>`;
  body += `<circle cx="${x + 142}" cy="415" r="80" fill="none" stroke="#ff0" stroke-dasharray="4 3"/>`;
  body += `<image x="${x + 280}" y="287" width="256" height="256" href="data:image/svg+xml;base64,${b64(L.mono.replace('fill="#000" mask', 'fill="#fff" mask'))}"/>`;
  body += `<image x="${x + 14}" y="560" width="256" height="256" href="data:image/svg+xml;base64,${b64(L.adMono)}"/><text x="${x + 290}" y="600" font-size="40" font-family="DejaVu Sans">${v.label}</text>`;
});
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${vs.length * 560}" height="820"><rect width="100%" height="100%" fill="#888"/>${body}</svg>`;
writeFileSync(out, new Resvg(svg, { font: { loadSystemFonts: true } }).render().asPng());
console.log(out);
