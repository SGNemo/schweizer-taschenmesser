import { afterEach, describe, expect, it } from 'vitest';
import type { TaschenmesserDB } from '@/core/db/db';
import { formatHlc } from '@/core/db/hlc';
import { createTestDb } from '@/test-utils';
import { BACKUP_FORMAT, BACKUP_VERSION, type Backup } from '@/core/backup/backup';
import { applyShare, shareableTables } from './share';

// R5 (launch review 2026-11): a partner's share file was merged into every shareable table, not
// only the modules of the pair. A known pair's file now writes only the pair's modules.
const dbs: TaschenmesserDB[] = [];
afterEach(async () => {
  for (const db of dbs.splice(0)) await db.delete();
});

const row = (id: string, title: string) => ({
  id,
  deletedAt: null,
  title,
  _f: { title: formatHlc(Date.now() - 1000, 0, 'partner') },
});

describe('share scope of a pair', () => {
  it('writes only the modules the pair agreed on', async () => {
    const db = createTestDb();
    dbs.push(db);
    const tables = shareableTables();
    const other = tables.find((t) => !t.startsWith('example_'))!;
    expect(tables).toContain('example_entry');
    const backup: Backup = {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      tables: {
        example_entry: [row('e1', 'erlaubt')] as never,
        [other]: [row('x1', 'nicht vereinbart')] as never,
      },
    };
    await applyShare(backup, db, undefined, ['example']);
    expect(await db.table('example_entry').count()).toBe(1);
    expect(await db.table(other).count()).toBe(0);
  });
});
