#!/usr/bin/env node
/**
 * Markdown tables from `npm run measure:click` (e2e/perf/click.spec.ts), for docs/perf/CLICK-TO-CONTENT-*.md.
 *
 *   node scripts/click-table.mjs [label]            times: per target first content / done, first and second visit
 *   node scripts/click-table.mjs [label] --causes   cause trail of the first visit (desktop and phone, slowest rate)
 *   node scripts/click-table.mjs <a> --diff <b>     done of the first visit, label a against b (before/after)
 *
 * Reads node_modules/.cache/click/<label>-{desktop,phone}.json (CLICK_OUT overrides the folder).
 */
import { existsSync, readFileSync } from 'node:fs';

const args = process.argv.slice(2);
const label = args[0] && !args[0].startsWith('--') ? args[0] : 'run';
const dir = process.env.CLICK_OUT ?? 'node_modules/.cache/click';
const load = (l, d) => {
  const f = `${dir}/${l}-${d}.json`;
  return existsSync(f) ? JSON.parse(readFileSync(f, 'utf8')) : {};
};
const s = (ms) => (ms / 1000).toFixed(1);
const cell = (x, capped) =>
  x ? `${s(x.first)} / ${s(x.done)}${x.capped || capped ? '+' : ''}` : '–';
const devices = { desktop: 'Desktop', phone: 'Handy' };
const data = Object.fromEntries(Object.keys(devices).map((d) => [d, load(label, d)]));
const rates = [...new Set(Object.values(data).flatMap((r) => Object.keys(r)))].sort(
  (a, b) => parseFloat(a) - parseFloat(b),
);
const ids = [
  ...new Set(Object.values(data).flatMap((r) => Object.values(r).flatMap((o) => Object.keys(o)))),
];
const order = (id) => (id === 'overview' ? 0 : id === 'settings' ? 1 : id === 'library' ? 2 : 3);
ids.sort((a, b) => order(a) - order(b) || a.localeCompare(b));
const name = (id) => (id.endsWith('+') ? `${id.slice(0, -1)} (Dialog)` : id);

if (args.includes('--diff')) {
  const other = args[args.indexOf('--diff') + 1];
  const before = Object.fromEntries(Object.keys(devices).map((d) => [d, load(other, d)]));
  const cols = Object.keys(devices).flatMap((d) => rates.map((r) => [d, r]));
  console.log(`| Ziel | ${cols.map(([d, r]) => `${devices[d]} ${r}`).join(' | ')} |`);
  console.log(`|---|${cols.map(() => '---|').join('')}`);
  for (const id of ids) {
    const row = cols.map(([d, r]) => {
      const a = before[d][r]?.[id]?.first;
      const b = data[d][r]?.[id]?.first;
      return a && b ? `${s(a.done)} → ${s(b.done)}` : '–';
    });
    console.log(`| ${name(id)} | ${row.join(' | ')} |`);
  }
} else if (args.includes('--causes')) {
  const rate = rates.at(-1);
  console.log(
    `| Ziel | Gerät | fertig (s) | Dateien nachgeladen (Anzahl, KB) | DB-Lesungen (Anfragen, Zeilen) | Hauptthread (ms) | Ladezustand sichtbar (ms) |`,
  );
  console.log('|---|---|---|---|---|---|---|');
  for (const id of ids)
    for (const d of Object.keys(devices)) {
      const x = data[d][rate]?.[id];
      if (!x?.first) continue;
      const f = x.first;
      console.log(
        `| ${name(id)} | ${devices[d]} | ${s(f.done)} | ${f.chunks}, ${f.chunkKb} | ${f.idbOps}, ${f.idbRows} | ${f.taskMs} | ${f.loadingMs} |`,
      );
    }
} else {
  const cols = Object.keys(devices).flatMap((d) => rates.map((r) => [d, r]));
  console.log(
    `| Ziel | ${cols.map(([d, r]) => `${devices[d]} ${r} 1. Besuch | 2. Besuch`).join(' | ')} |`,
  );
  console.log(`|---|${cols.map(() => '---|---|').join('')}`);
  for (const id of ids) {
    const row = cols.map(([d, r]) => {
      const x = data[d][r]?.[id];
      if (!x) return '– | –';
      if (x.note && !x.first) return `${x.note} | `;
      return `${cell(x.first)} | ${cell(x.second)}`;
    });
    console.log(`| ${name(id)} | ${row.join(' | ')} |`);
  }
}
