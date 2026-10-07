import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { parseBackup, type Backup } from '@/core/backup/backup';
import { preview, restoreBackup } from '@/core/backup/restore';
import type { TaschenmesserDB } from '@/core/db/db';
import { createTestDb } from '@/test-utils';

/**
 * One backup per released version (`tests/fixtures/backups/<tag>.json`, invented data, made by
 * `scripts/gen-backup-fixtures.mjs`). Each must still restore into the current schema: everything
 * the current version knows arrives with the right counts, tables it no longer has are skipped
 * (named, no error), and a second restore changes nothing.
 */
const DIR = resolve(process.cwd(), 'tests/fixtures/backups');
const FILES = readdirSync(DIR).filter((f) => /^v\d.*\.json$/.test(f));

const load = (file: string): Backup => {
  const parsed = parseBackup(readFileSync(resolve(DIR, file), 'utf8'));
  if (!parsed.ok) throw new Error(`${file} does not parse: ${parsed.reason}`);
  return parsed.backup;
};

const dbs: TaschenmesserDB[] = [];
afterEach(async () => {
  for (const d of dbs.splice(0)) {
    d.close();
    await d.delete();
  }
});

const fresh = () => {
  const d = createTestDb();
  dbs.push(d);
  return d;
};

it('has a fixture for every released 0.3.x version', () => {
  expect(FILES).toEqual(
    expect.arrayContaining(['v0.3.0-beta.1.json', 'v0.3.0.json', 'v0.3.1.json']),
  );
});

describe.each(FILES)('release fixture %s', (file) => {
  it('is a valid backup with data in it', () => {
    const backup = load(file);
    const rows = Object.values(backup.tables).reduce((n, r) => n + r.length, 0);
    expect(rows).toBeGreaterThan(5);
  });

  it('restores every table the current version knows, with the right counts', async () => {
    const backup = load(file);
    const db = fresh();
    const known = new Set(db.tables.map((t) => t.name));
    const { summary } = await restoreBackup(backup, 'replace', {
      database: db,
      safety: async () => 'safety',
    });
    let expected = 0;
    for (const [name, rows] of Object.entries(backup.tables)) {
      if (!known.has(name)) continue;
      expected += rows.length;
      expect(await db.table(name).count(), name).toBe(rows.length);
    }
    expect(summary.records).toBe(expected);
    expect(expected).toBeGreaterThan(0);
  });

  it('names the tables of retired modules instead of failing', async () => {
    const backup = load(file);
    const db = fresh();
    const known = new Set(db.tables.map((t) => t.name));
    const gone = Object.entries(backup.tables).filter(([n, r]) => !known.has(n) && r.length > 0);
    const plan = await preview(backup, 'merge', db);
    expect(plan.skippedTables).toBeGreaterThanOrEqual(gone.length);
    expect(gone.length).toBeGreaterThan(0); // shopping, habits and reminders no longer exist
  });

  it('a second restore of the same file changes nothing', async () => {
    const backup = load(file);
    const db = fresh();
    const opts = { database: db, safety: async () => 'safety' };
    await restoreBackup(backup, 'replace', opts);
    const plan = await preview(backup, 'merge', db);
    expect(plan.totals.added).toBe(0);
    expect(plan.totals.replaced).toBe(0);
  });
});
