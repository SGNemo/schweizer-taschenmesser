import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import type { TaschenmesserDB } from '@/core/db/db';
import { createTestDb } from '@/test-utils';
import { loadLastBackup, recordFileBackup } from './lastBackup';

let database: TaschenmesserDB;
const meta = () => database.table<{ key: string; value: unknown }, string>('_meta');

beforeEach(async () => {
  database = createTestDb();
  await database.open();
});
afterEach(async () => {
  database.close();
  await database.delete();
});

describe('last backup for the status head (D07)', () => {
  it('is empty before anything was saved', async () => {
    expect(await loadLastBackup(database)).toBeUndefined();
  });

  it('a backup saved as a file counts, also without automatic backups', async () => {
    await recordFileBackup(true, database, 1_000);
    expect(await loadLastBackup(database)).toEqual({ at: 1_000, ok: true, kind: 'file' });
  });

  it('the newer of file and automatic backup wins', async () => {
    await meta().put({ key: 'backup.auto.last', value: { at: 2_000, ok: true, file: 'auto-x' } });
    await recordFileBackup(false, database, 1_000);
    expect(await loadLastBackup(database)).toEqual({ at: 2_000, ok: true, kind: 'auto' });
    await recordFileBackup(false, database, 3_000);
    expect(await loadLastBackup(database)).toEqual({ at: 3_000, ok: true, kind: 'file' });
  });

  it('a failed automatic run after the last file stays visible', async () => {
    await recordFileBackup(true, database, 1_000);
    await meta().put({
      key: 'backup.auto.last',
      value: { at: 2_000, ok: false, error: 'write-failed' },
    });
    expect(await loadLastBackup(database)).toEqual({ at: 2_000, ok: false, kind: 'auto' });
  });

  it('keeps only time and kind on the device, nothing about the file', async () => {
    await recordFileBackup(true, database, 1_000);
    expect((await meta().get('backup.file.last'))?.value).toEqual({ at: 1_000, encrypted: true });
  });
});
