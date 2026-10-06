#!/usr/bin/env node
/**
 * Regenerates tests/fixtures/backups/<release>.json: one backup per released app version, made of
 * INVENTED data. The table list is read from that release's `schema.snapshot.json` (git tag), the
 * row shapes are the ones of that release's module schemas (identical across 0.3.x, checked with
 * `git diff <tag> <tag> -- web/src/modules/<id>/schema.ts`). Deterministic: no clock, no randomness.
 *
 *   node scripts/gen-backup-fixtures.mjs            # all releases below (tags must be fetched)
 *   node scripts/gen-backup-fixtures.mjs v0.3.1     # one release
 *
 * Adding a release: add it to RELEASES (tag → rows per table), run the script, commit the JSON.
 */
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const out = resolve(root, 'web/tests/fixtures/backups');

/** tag → how many invented rows each known table gets (more data in later releases). */
const RELEASES = { 'v0.3.0-beta.1': 1, 'v0.3.0': 2, 'v0.3.1': 3 };

const BASE = 1_790_000_000_000;
const hlc = (ms, dev) => `${ms}-0000-${dev}`;

/** Builds a sync row: envelope + fields + a field-HLC for every field (what a real backup holds). */
function row(tag, table, n, fields) {
  const dev = 'fixdev01';
  const at = BASE + n * 1000;
  const f = Object.fromEntries([...Object.keys(fields), 'deletedAt'].map((k) => [k, hlc(at, dev)]));
  return {
    id: `${tag}-${table}-${n}`,
    createdAt: at,
    updatedAt: at,
    deviceId: dev,
    deletedAt: null,
    _f: f,
    ...fields,
  };
}

/** Field factories for the tables whose shape is known (all others stay empty). */
const FACTORIES = {
  todos_list: (tag, n) => ({ name: `Liste ${n}`, order: n }),
  todos_task: (tag, n) => ({
    listId: `${tag}-todos_list-${n}`,
    title: `Aufgabe ${n}`,
    done: n % 2 === 0,
    priority: n % 4,
    order: n,
  }),
  notes_note: (tag, n) => ({ title: `Notiz ${n}`, body: 'Erfundener Text', pinned: n === 1 }),
  finance_account: (tag, n) => ({ name: `Konto ${n}`, openingBalanceMinor: 10000 * n, order: n }),
  finance_category: (tag, n) => ({ name: `Kategorie ${n}`, kind: n % 2 ? 'expense' : 'income' }),
  finance_transaction: (tag, n) => ({
    accountId: `${tag}-finance_account-${n}`,
    kind: 'expense',
    amountMinor: 1250 * n,
    date: `2026-09-${String(10 + n).padStart(2, '0')}`,
    payee: `Laden ${n}`,
  }),
  shopping_item: (tag, n) => ({ name: `Artikel ${n}`, quantity: `${n}`, done: false }),
  habits_habit: (tag, n) => ({
    name: `Gewohnheit ${n}`,
    weekdays: [1, 2, 3, 4, 5],
    archived: false,
  }),
  habits_check: (tag, n) => ({
    habitId: `${tag}-habits_habit-${n}`,
    date: `2026-09-${String(10 + n).padStart(2, '0')}`,
  }),
  reminders_reminder: (tag, n) => ({
    title: `Erinnerung ${n}`,
    startDate: `2026-10-${String(10 + n).padStart(2, '0')}`,
    time: '08:00',
    active: true,
  }),
};

const git = (...args) => execFileSync('git', args, { cwd: root, encoding: 'utf8' });

function build(tag) {
  const perTable = RELEASES[tag];
  if (!perTable) throw new Error(`unknown release ${tag}`);
  const snapshot = JSON.parse(git('show', `${tag}:web/src/core/db/schema.snapshot.json`));
  const tables = {};
  for (const name of Object.keys(snapshot.stores).sort()) {
    if (name.startsWith('_')) continue; // system tables are device-local, never in a backup
    const make = FACTORIES[name];
    tables[name] = make
      ? Array.from({ length: perTable }, (_, i) => row(tag, name, i + 1, make(tag, i + 1)))
      : [];
  }
  return {
    format: 'taschenmesser-backup',
    version: 1,
    exportedAt: '2026-10-01T09:00:00.000Z',
    tables,
  };
}

const wanted = process.argv.slice(2);
mkdirSync(out, { recursive: true });
for (const tag of wanted.length ? wanted : Object.keys(RELEASES)) {
  const file = resolve(out, `${tag}.json`);
  writeFileSync(file, JSON.stringify(build(tag), null, 2) + '\n');
  console.log(`wrote ${file}`);
}
