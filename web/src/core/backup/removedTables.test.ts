import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { parseBackup } from '@/core/backup/backup';
import { preview, restoreBackup } from '@/core/backup/restore';
import type { TaschenmesserDB } from '@/core/db/db';
import { createTestDb } from '@/test-utils';

/**
 * A backup from before 0.5 (invented data) still contains the tables of the modules that were
 * merged or retired (here `reminders_reminder`). Since 0.9.0 those tables are gone: the import must
 * not fail, brings in everything it still knows and names how many tables it leaves out.
 */
const FIXTURE = resolve(process.cwd(), 'src/core/backup/fixtures/backup-0.3.1-reminders.json');
const load = () => {
  const parsed = parseBackup(readFileSync(FIXTURE, 'utf8'));
  if (!parsed.ok) throw new Error('fixture does not parse');
  return parsed.backup;
};

const dbs: TaschenmesserDB[] = [];
afterEach(async () => {
  for (const d of dbs.splice(0)) {
    d.close();
    await d.delete();
  }
});

describe('a backup with tables this version no longer has', () => {
  it('names the skipped tables in the preview', async () => {
    const db = createTestDb();
    dbs.push(db);
    const plan = await preview(load(), 'merge', db);
    expect(plan.skippedTables).toBe(1);
    expect(plan.totals.added).toBe(1); // the calendar event
  });

  it('imports what it still knows and drops the rest without an error', async () => {
    const db = createTestDb();
    dbs.push(db);
    const { summary } = await restoreBackup(load(), 'merge', {
      database: db,
      safety: async () => 'safety',
    });
    expect(summary.skippedTables).toBe(1);
    const events = await db.table('calendar_event').toArray();
    expect(events.map((e) => e.id)).toEqual(['fx-ev-1']);
    expect(db.tables.map((t) => t.name)).not.toContain('reminders_reminder');
  });
});
