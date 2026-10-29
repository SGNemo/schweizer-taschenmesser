import { afterEach, describe, expect, it } from 'vitest';
import { syncedTableNames } from '@/core/db/schema';
import { allManifests } from '@/core/modules/registry';
import type { TaschenmesserDB } from '@/core/db/db';
import { createTestDb } from '@/test-utils';
import { createBackup, serializeBackup } from './backup';
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
