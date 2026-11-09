/**
 * UI audit 2026-11: turns the facts files of the tour (`audit-tour.spec.ts`) into the tables of REPORT.md.
 * Usage (web/): node ../docs/design/ui-audit-2026-11/tools/summarize.mjs [.screens/ui-audit] > ../docs/design/ui-audit-2026-11/MEASURES.md
 * Reads <dir>/<viewport>-<scheme>/<seed|empty>/facts-*.json and prints Markdown: stimulus per page, head and type
 * consistency, surfaces (borders / shadows / tints), motion, states, dialogs, layout shift, axe, phone targets.
 */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';

const root = process.argv[2] ?? '.screens/ui-audit';
const runs = [];
for (const vp of readdirSync(root)) {
  if (!/^\d+x\d+-(light|dark)$/.test(vp)) continue;
  for (const part of ['seed', 'empty']) {
    const file = path.join(root, vp, part, `facts-${part}.json`);
    if (existsSync(file)) runs.push({ vp, part, facts: JSON.parse(readFileSync(file, 'utf8')) });
  }
}
const pick = (vp, part) => runs.find((r) => r.vp === vp && r.part === part)?.facts;
const fmt = (n) => (n === null || n === undefined ? '–' : typeof n === 'number' ? (Number.isInteger(n) ? String(n) : n.toFixed(2)) : String(n));
const pages = (facts) => Object.entries(facts).filter(([k, v]) => k.startsWith('page-') && !k.includes('--') && v && v.stimulus);

const out = [];
const h = (s) => out.push(`\n### ${s}\n`);
const table = (head, rows) => { out.push(`| ${head.join(' | ')} |`); out.push(`| ${head.map(() => '---').join(' | ')} |`); for (const r of rows) out.push(`| ${r.map(fmt).join(' | ')} |`); };

for (const [vp, part] of [['1920x1080-dark', 'seed'], ['412x915-dark', 'seed'], ['1920x1080-dark', 'empty']]) {
  const f = pick(vp, part);
  if (!f) continue;
  h(`Reizlast über dem Falz – ${vp}, ${part}`);
  table(
    ['Seite', 'Aktionen', 'Primär', 'Farbe Text', 'Farbe Fläche', 'Farbe Icon', 'Wörter', 'Zeichen', 'Schriftgrößen', 'Gewichte', 'CLS'],
    pages(f).map(([k, v]) => [k.replace('page-', ''), v.stimulus.actionsAboveFold, v.stimulus.primaries.length, v.stimulus.colouredText, v.stimulus.colouredSurfaces, v.stimulus.colouredIcons, v.stimulus.words, v.stimulus.textChars, Object.keys(v.fontSizes).length, Object.keys(v.fontWeights).length, v.cls]),
  );
}

const d = pick('1920x1080-dark', 'seed');
if (d) {
  h('Köpfe und Typografie – 1920 dunkel, Seed');
  table(
    ['Seite', 'Kopf px', 'Slot', 'h1 Größe/Gewicht/Schrift', 'h2/h3-Varianten', 'Zeilen (n · Median · min–max)', 'Abstandswerte', 'Icons (px/stroke)'],
    pages(d).map(([k, v]) => [k.replace('page-', ''), v.head?.height ?? '–', v.head?.size ?? '–', v.h1 ? `${v.h1.size}/${v.h1.weight}/${v.h1.family}` : '–', Object.keys(v.headings).length, v.rows.n ? `${v.rows.n} · ${v.rows.median} · ${v.rows.min}–${v.rows.max}` : '–', v.spacing.distinct, Object.entries(v.icons).slice(0, 4).map(([a, b]) => `${a}×${b}`).join(', ')]),
  );
  h('Flächen: Rahmen vs. Schatten vs. Tönung – 1920 dunkel, Seed');
  table(
    ['Seite', 'Rahmen (1 px rundum)', 'Schatten', 'getönt', 'Radien (px×n)', 'Animationen', 'Transitions (Eigenschaft×n)'],
    pages(d).map(([k, v]) => [k.replace('page-', ''), v.surfaces.bordered, v.surfaces.shadowed, v.surfaces.tinted, Object.entries(v.surfaces.radii).map(([a, b]) => `${a}×${b}`).join(', '), v.motion.animated.length, Object.entries(v.motion.transitions).slice(0, 5).map(([a, b]) => `${a}×${b}`).join(', ')]),
  );
  h('Dialoge – 1920 dunkel, Seed');
  table(
    ['Modul', 'Auslöser', 'Titel', 'Felder', 'Knöpfe', 'Breite×Höhe', 'Primär'],
    Object.entries(d).filter(([k]) => k.startsWith('dialog-')).map(([k, v]) => [k.replace('dialog-', ''), v.trigger ?? '–', v.title ?? '–', v.fields ?? '–', v.buttons ?? '–', v.box ? `${Math.round(v.box.width)}×${Math.round(v.box.height)}` : '–', v.stimulus ? v.stimulus.primaries.join(' / ') : '–']),
  );
  if (d.states) {
    h('Zustände (Rechnungen, 1920 dunkel)');
    out.push('```json'); out.push(JSON.stringify(d.states, null, 1)); out.push('```');
  }
  h('axe (serious/critical) – 1920 dunkel, Seed');
  const ax = [];
  for (const [k, v] of Object.entries(d)) if (v && Array.isArray(v.axe)) for (const a of v.axe) if (a.impact === 'serious' || a.impact === 'critical') ax.push([k, a.id, a.impact, a.n, a.targets[0] ?? '']);
  table(['Seite', 'Regel', 'Schwere', 'n', 'Erstes Ziel'], ax.slice(0, 40));
  if (d.widgetSizes) {
    h('Widget-Größen (Übersicht „Ausführlich“, 1920)');
    table(['Widget', 'Breite', 'Höhe'], Object.entries(d.widgetSizes).map(([k, v]) => [k.replace('widget-', ''), v.w, v.h]));
  }
}
const p = pick('412x915-dark', 'seed');
if (p) {
  h('Handy: kleine Ziele (< 40 px) und abgeschnittener Text – 412 dunkel, Seed');
  const rows = [];
  for (const [k, v] of Object.entries(p)) if (v && (v.small?.length || v.clipped?.length)) rows.push([k, v.small?.length ?? 0, (v.small ?? []).slice(0, 2).join('; '), v.clipped?.length ?? 0, (v.clipped ?? []).slice(0, 2).join('; ')]);
  table(['Seite', 'klein n', 'Beispiele', 'abgeschnitten n', 'Beispiele'], rows.slice(0, 40));
}
for (const r of runs) {
  const over = Object.entries(r.facts).filter(([, v]) => v && v.overflow && (v.overflow.doc > 0 || v.overflow.main > 0)).map(([k, v]) => `${k} (${v.overflow.doc}/${v.overflow.main})`);
  out.push(`\nÜberlauf ${r.vp} ${r.part}: ${over.length ? over.join(', ') : 'keiner'}`);
}
console.log(out.join('\n'));
