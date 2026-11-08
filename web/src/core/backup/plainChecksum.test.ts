import { afterEach, describe, expect, it } from 'vitest';
import { syncedTableNames } from '@/core/db/schema';
import { allManifests } from '@/core/modules/registry';
import type { TaschenmesserDB } from '@/core/db/db';
import { createTestDb } from '@/test-utils';
import { createBackup, importBackup, serializeBackup } from './backup';
import { plainChecksumStatus, readBackupText, serializeSealedBackup } from './encrypted';
import { verifyBackup, type VerifyDeps } from './verify';

const dbs: TaschenmesserDB[] = [];
const newDb = () => {
  const db = createTestDb();
  dbs.push(db);
  return db;
};
const deps = (): VerifyDeps => ({
  tableNames: syncedTableNames(allManifests),
  createTempDb: newDb,
});
afterEach(async () => {
  for (const db of dbs.splice(0)) {
    db.close();
    await db.delete();
  }
});

const sealed = async () => serializeSealedBackup(await createBackup(newDb()));

describe('plain backup checksum', () => {
  it('a sealed file passes the check, import and verification', async () => {
    const text = await sealed();
    expect(await plainChecksumStatus(text)).toBe('ok');
    expect(await readBackupText(text)).toMatchObject({ ok: true, encrypted: false });
    const report = await verifyBackup(text, undefined, deps());
    expect(report.ok).toBe(true);
    expect(report.unprotected).toBe(false);
    expect(report.steps.find((s) => s.id === 'checksum')!.status).toBe('ok');
  });

  it('an edited sealed file is refused with the checksum step failed', async () => {
    const json = JSON.parse(await sealed()) as { tables: Record<string, unknown[]> };
    json.tables['accounts_entry'] = [{ id: 'x', deletedAt: null, _f: {}, secret: 'v1.AAAA.BBBB' }];
    const text = JSON.stringify(json);
    expect(await plainChecksumStatus(text)).toBe('mismatch');
    expect(await readBackupText(text)).toEqual({ ok: false, reason: 'checksum-mismatch' });
    const report = await verifyBackup(text, undefined, deps());
    expect(report).toMatchObject({ ok: false, failure: 'checksum-mismatch' });
    expect(report.steps.find((s) => s.id === 'checksum')!.status).toBe('failed');
  });

  it('a file without checksum (older versions) still works but is reported unprotected', async () => {
    const text = serializeBackup(await createBackup(newDb()));
    expect(await plainChecksumStatus(text)).toBe('missing');
    expect(await readBackupText(text)).toMatchObject({ ok: true });
    const report = await verifyBackup(text, undefined, deps());
    expect(report).toMatchObject({ ok: true, unprotected: true });
  });
});

describe('readable plain backup (D10)', () => {
  it('names its format in the file and is indented for a text editor', async () => {
    const text = await sealed();
    const json = JSON.parse(text) as Record<string, unknown>;
    expect(Object.keys(json).slice(0, 3)).toEqual(['format', 'version', 'about']);
    expect(json.about).toMatch(/docs\/user\/backup\.md#file-format/);
    expect(text.split('\n').length).toBeGreaterThan(10);
  });

  it('the same file imports without loss: export → restore → export gives the same tables', async () => {
    const source = newDb();
    await source.table('notes_note').put({
      id: 'n1',
      title: 'Netzplan',
      body: 'VLAN 10 #netz',
      pinned: false,
      notebookId: 'nb1',
      order: 3,
      createdAt: 1794000000000,
      updatedAt: 1794000000000,
      deviceId: 'pc',
      deletedAt: null,
      _f: Object.fromEntries(
        ['title', 'body', 'pinned', 'notebookId', 'order', 'deletedAt'].map((f) => [
          f,
          '1794000000000-0000-pc',
        ]),
      ),
    });
    const first = await serializeSealedBackup(await createBackup(source));
    const read = await readBackupText(first);
    if (!read.ok) throw new Error(read.reason);
    const target = newDb();
    await importBackup(read.backup, 'merge', target);
    const again = JSON.parse(serializeBackup(await createBackup(target))) as { tables: unknown };
    expect(again.tables).toEqual((JSON.parse(first) as { tables: unknown }).tables);
  });
});
