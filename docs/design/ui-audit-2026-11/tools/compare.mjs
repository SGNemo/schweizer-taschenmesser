/**
 * UI audit 2026-11, acceptance sweep 0b-8: before/after tables for MEASURES.md.
 * "Before" = the tables of the audit (the generated part of the old MEASURES.md, passed as a file);
 * "after" = the facts of a new tour (`audit-tour.spec.ts`). Same definitions on both sides, except the
 * corrections of 0b-8 listed in MEASURES „Werkzeug korrigiert“ (animations without the cap, CLS reset before each dialog,
 * the head as `main [data-head]`, tone steps neutral in „getönt“).
 * Usage (web/): node ../docs/design/ui-audit-2026-11/tools/compare.mjs ../docs/design/ui-audit-2026-11/MEASURES.md [.screens/ui-audit]
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const [beforeFile, root = '.screens/ui-audit'] = process.argv.slice(2);
// A MEASURES.md with both parts: read only the audit's tables (from the heading „## Vorher“ on).
const all = readFileSync(beforeFile, 'utf8').split('\n');
const from = all.findIndex((l) => l.startsWith('## Vorher'));
const md = from >= 0 ? all.slice(from) : all;

/** Rows of the table under the heading that starts with `title`, keyed by the first cell. */
function tableAfter(title) {
  const i = md.findIndex((l) => l.startsWith(`### ${title}`));
  if (i < 0) return { head: [], rows: new Map() };
  const lines = [];
  for (let j = i + 1; j < md.length && !md[j].startsWith('### '); j++) if (md[j].startsWith('|')) lines.push(md[j]);
  const cells = (l) => l.split('|').slice(1, -1).map((c) => c.trim());
  const head = cells(lines[0] ?? '|');
  const rows = new Map();
  for (const l of lines.slice(2)) { const c = cells(l); rows.set(c[0], Object.fromEntries(head.map((h, k) => [h, c[k]]))); }
  return { head, rows };
}
const facts = (vp, part) => {
  const f = path.join(root, vp, part, `facts-${part}.json`);
  return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : null;
};
const num = (v) => (v === undefined || v === null || v === '–' || v === '' ? null : Number(String(v).replace(',', '.')));
const name = (k) => k.replace('page-', '').replace('overview-all', 'übersicht-ausführlich').replace('overview-calm', 'übersicht-ruhig');
// The audit's tables name the overview rows in two ways (`übersicht-…` in the stimulus tables, `overview-…` in the others).
const rawName = (k) => k.replace('page-', '');
const find = (rows, k) => rows.get(name(k)) ?? rows.get(rawName(k));
// „Inhalt ab y“ of the audit on library, tools and settings measured elements inside the head card (93/169/174):
// not comparable, left out of the medians.
const NO_Y = (k) => /^page-(library|tools|settings)/.test(k);
const pages = (f) => Object.entries(f).filter(([k, v]) => ((k.startsWith('page-') && !k.includes('--')) || k === 'overview-all' || k === 'overview-calm') && v && v.stimulus);
const arrow = (a, b) => (a === null && b === null ? '–' : a === null ? `neu ${fmt(b)}` : b === null ? `${fmt(a)} → –` : a === b ? fmt(a) : `${fmt(a)} → ${fmt(b)}`);
const fmt = (n) => (n === null || n === undefined ? '–' : Number.isInteger(n) ? String(n) : n.toFixed(2));
const median = (xs) => { const s = xs.filter((x) => x !== null && !Number.isNaN(x)).sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : null; };
const sum = (xs) => xs.filter((x) => x !== null && !Number.isNaN(x)).reduce((a, b) => a + b, 0);
const out = [];
const table = (head, rows) => { out.push(`| ${head.join(' | ')} |`, `| ${head.map(() => '---').join(' | ')} |`); for (const r of rows) out.push(`| ${r.join(' | ')} |`); };

const STIM = [['Aktionen', (v) => v.stimulus.actionsAboveFold], ['davon Chrome', (v) => v.stimulus.chromeActions], ['Inhalt ab y', (v) => v.stimulus.firstContentY], ['Kopf px', (v) => v.head?.height ?? null], ['Farbe Text', (v) => v.stimulus.colouredText], ['Farbe Fläche', (v) => v.stimulus.colouredSurfaces], ['Verläufe', (v) => v.stimulus.gradients], ['Schriftgrößen', (v) => Object.keys(v.fontSizes).length]];
const summary = [];
for (const [vp, part, label] of [['1920x1080-dark', 'seed', 'Desktop 1920 dunkel, Seed'], ['412x915-dark', 'seed', 'Handy 412 dunkel, Seed'], ['1920x1080-dark', 'empty', 'Desktop 1920 dunkel, leer']]) {
  const after = facts(vp, part);
  const before = tableAfter(`Reizlast über dem Falz – ${vp}, ${part}`).rows;
  if (!after) continue;
  out.push(`\n### Reizlast vorher → nachher – ${label}\n`);
  const rows = [];
  const cols = STIM.map(() => ({ b: [], a: [] }));
  for (const [k, v] of pages(after)) {
    const b = find(before, k);
    rows.push([name(k), ...STIM.map(([h, get], i) => {
      const skip = h === 'Inhalt ab y' && NO_Y(k);
      const x = b && !skip ? num(b[h]) : null; const y = get(v) ?? null;
      if (b && !skip) { cols[i].b.push(x); cols[i].a.push(y); }
      return skip && b ? `n/v → ${fmt(y)}` : arrow(x, y);
    })]);
  }
  table(['Seite', ...STIM.map(([h]) => h)], rows);
  summary.push([label, 'Median (Seiten in beiden Läufen)', ...cols.map((c) => arrow(median(c.b), median(c.a)))]);
  summary.push([label, 'Summe', ...cols.map((c, i) => (i === 2 || i === 3 ? '–' : arrow(sum(c.b), sum(c.a))))]);
}

const d = facts('1920x1080-dark', 'seed');
if (d) {
  const before = tableAfter('Flächen: Rahmen vs. Schatten vs. Tönung – 1920 dunkel, Seed').rows;
  out.push('\n### Flächen und Bewegung vorher → nachher – 1920 dunkel, Seed\n');
  out.push('Animationen vorher bei 10 gekappt (`≥ 10`), nachher ohne Kappung.\n');
  const F = [['Rahmen (rundum)', (v) => v.surfaces.bordered], ['Schatten', (v) => v.surfaces.shadowed], ['getönt', (v) => v.surfaces.tinted], ['--surface-2', (v) => v.surfaces.surface2], ['Animationen', (v) => v.motion.animated.length]];
  const cols = F.map(() => ({ b: [], a: [] }));
  const rows = [];
  for (const [k, v] of pages(d)) {
    const b = find(before, k);
    rows.push([name(k), ...F.map(([h, get], i) => { const x = b ? num(b[h]) : null; const y = get(v); if (b) { cols[i].b.push(x); cols[i].a.push(y); } return h === 'Animationen' && x === 10 ? `≥ 10 → ${y}` : arrow(x, y); })]);
  }
  table(['Seite', ...F.map(([h]) => h)], rows);
  out.push('');
  // „getönt“ uses the saturation of the audit and is not readable in the dark theme; the light value (all pages) counts.
  const L = facts('1920x1080-light', 'seed');
  const lightSum = (i) => (L ? sum(pages(L).map(([, v]) => F[i][1](v))) : null);
  table(['Größe', 'Summe vorher → nachher (dunkel)', 'Seiten > 0 vorher → nachher', 'nachher hell (alle Seiten)'], F.map(([h], i) => [h, arrow(sum(cols[i].b), sum(cols[i].a)), arrow(cols[i].b.filter((x) => x > 0).length, cols[i].a.filter((x) => x > 0).length), fmt(lightSum(i))]));
}

const p = facts('412x915-dark', 'seed');
if (p) {
  const before = tableAfter('Handy: Köpfe und Zeilenhöhen – 412 dunkel, Seed').rows;
  out.push('\n### Handy: Zeilenhöhen vorher → nachher – 412 dunkel, Seed\n');
  const rows = [];
  for (const [k, v] of pages(p)) {
    const b = find(before, k);
    const r = v.rows.n ? `${v.rows.n} · ${v.rows.median} · ${v.rows.min}–${v.rows.max}` : '–';
    rows.push([name(k), b?.['Zeilen (n · Median · min–max)'] ?? '–', r]);
  }
  table(['Seite', 'Zeilen vorher (n · Median · min–max)', 'nachher'], rows);
}

// Light against dark: the chroma measure (Sven, 2026-11-13) next to the saturation measure.
const pairs = [['1920x1080', 'Desktop'], ['412x915', 'Handy']];
out.push('\n### Farbe über dem Falz: Sättigung vs. Chroma, hell und dunkel (Seed)\n');
out.push('Sättigung = (max − min) / max > 0,12 (Fläche) bzw. > 0,25 (Text), wie im Audit; Chroma = (max − min) / 255 > 0,10, Tonstufen `--surface-raised`/`-sunken` neutral. Summen über alle Seiten.\n');
const crow = [];
for (const [vp, label] of pairs) {
  const L = facts(`${vp}-light`, 'seed');
  const D = facts(`${vp}-dark`, 'seed');
  if (!L || !D) continue;
  const s = (f, get) => sum(pages(f).map(([, v]) => get(v) ?? null));
  crow.push([label, 'Fläche Sättigung', s(L, (v) => v.stimulus.colouredSurfaces), s(D, (v) => v.stimulus.colouredSurfaces)]);
  crow.push([label, 'Fläche Chroma', s(L, (v) => v.stimulus.chromaSurfaces), s(D, (v) => v.stimulus.chromaSurfaces)]);
  crow.push([label, 'Text Sättigung', s(L, (v) => v.stimulus.colouredText), s(D, (v) => v.stimulus.colouredText)]);
  crow.push([label, 'Text Chroma', s(L, (v) => v.stimulus.chromaText), s(D, (v) => v.stimulus.chromaText)]);
}
table(['Gerät', 'Größe', 'hell', 'dunkel'], crow);

out.unshift('', '### Kurzfassung vorher → nachher\n', `| Lauf | Kennzahl | ${STIM.map(([h]) => h).join(' | ')} |`, `| --- | --- | ${STIM.map(() => '---').join(' | ')} |`, ...summary.map((r) => `| ${r.join(' | ')} |`));
console.log(out.join('\n'));
