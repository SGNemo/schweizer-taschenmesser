/**
 * UI audit 2026-11, acceptance sweep 0b-8: before/after tables for MEASURES.md.
 * "Before" = the tables of the audit (the generated part of the old MEASURES.md, passed as a file);
 * "after" = the facts of a new tour (`audit-tour.spec.ts`). Same definitions on both sides, except the
 * two corrections of 0b-8 (animations without the cap of 10, CLS of dialogs reset before each dialog).
 * Usage (web/): node ../docs/design/ui-audit-2026-11/tools/compare.mjs <before.md> [.screens/ui-audit]
 */
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

const [beforeFile, root = '.screens/ui-audit'] = process.argv.slice(2);
const md = readFileSync(beforeFile, 'utf8').split('\n');

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
    const b = before.get(name(k));
    rows.push([name(k), ...STIM.map(([h, get], i) => { const x = b ? num(b[h]) : null; const y = get(v) ?? null; if (b) { cols[i].b.push(x); cols[i].a.push(y); } return arrow(x, y); })]);
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
    const b = before.get(name(k));
    rows.push([name(k), ...F.map(([h, get], i) => { const x = b ? num(b[h]) : null; const y = get(v); if (b) { cols[i].b.push(x); cols[i].a.push(y); } return h === 'Animationen' && x === 10 ? `≥ 10 → ${y}` : arrow(x, y); })]);
  }
  table(['Seite', ...F.map(([h]) => h)], rows);
  out.push('');
  table(['Größe', 'Summe vorher → nachher', 'Seiten > 0 vorher → nachher'], F.map(([h], i) => [h, arrow(sum(cols[i].b), sum(cols[i].a)), arrow(cols[i].b.filter((x) => x > 0).length, cols[i].a.filter((x) => x > 0).length)]));
}

const p = facts('412x915-dark', 'seed');
if (p) {
  const before = tableAfter('Handy: Köpfe und Zeilenhöhen – 412 dunkel, Seed').rows;
  out.push('\n### Handy: Zeilenhöhen vorher → nachher – 412 dunkel, Seed\n');
  const rows = [];
  for (const [k, v] of pages(p)) {
    const b = before.get(name(k));
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
