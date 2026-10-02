import { beforeEach, describe, expect, it } from 'vitest';
import { blobKeys, getBlob, pruneBlobs, putBlob } from '@/core/blobs';
import { db } from '@/core/db/db';
import { collectCalendarItems, collectNotifications } from '@/core/modules/contributions';
import { validateManifest } from '@/core/modules/registry';
import { toEpoch } from '@/core/time/dates';
import { runMigrations } from '@/core/modules/migrate';
import {
  cancelDeadline,
  endOf,
  filterDocuments,
  formatSize,
  nextRelevantDate,
  safeFileName,
  sortDocuments,
  statusOf,
} from '../logic';
import manifest from '../manifest';
import { deleteDocument, documentRepo, saveDocument } from '../repo';
import { documentSchema } from '../schema';

beforeEach(async () => {
  await db.table('vault_document').clear();
  await db.table('_blobs').clear();
  await db.table('_settings').clear();
});

const doc = (over: Record<string, unknown> = {}) =>
  documentSchema.parse({ title: 'Reisepass', ...over });

describe('vault logic', () => {
  it('formats sizes', () => {
    expect(formatSize(512)).toBe('512 B');
    expect(formatSize(2048)).toBe('2 KB');
    expect(formatSize(3.5 * 1024 * 1024)).toBe('3,5 MB');
  });

  it('validates dates and keeps the legacy end date readable', () => {
    expect(
      documentSchema.safeParse({ title: 'x', startDate: '2026-02-01', endDate: '2026-01-01' })
        .success,
    ).toBe(false);
    expect(documentSchema.safeParse({ title: 'x', noticeDays: -1 }).success).toBe(false);
    expect(endOf(doc({ expiresOn: '2026-12-01' }))).toBe('2026-12-01');
    expect(endOf(doc({ expiresOn: '2026-12-01', endDate: '2027-01-01' }))).toBe('2027-01-01');
  });

  it('derives the cancellation deadline', () => {
    expect(cancelDeadline(doc({ endDate: '2026-12-31', noticeDays: 90 }))).toBe('2026-10-02');
    expect(cancelDeadline(doc({ endDate: '2026-12-31' }))).toBeUndefined();
    expect(cancelDeadline(doc({ noticeDays: 30 }))).toBeUndefined();
    expect(cancelDeadline(doc({ endDate: '2026-03-01', noticeDays: 0 }))).toBe('2026-03-01');
  });

  it.each([
    [{}, 'open-ended'],
    [{ endDate: '2026-09-28' }, 'expired'],
    [{ expiresOn: '2026-09-28' }, 'expired'], // before 0.6.0
    [{ endDate: '2026-09-29' }, 'soon'],
    [{ endDate: '2026-11-28' }, 'soon'], // 60 days, no deadline
    [{ endDate: '2026-11-29' }, 'ok'],
    [{ endDate: '2026-12-31', noticeDays: 90 }, 'act-now'], // deadline 2026-10-02, 3 days away
    [{ endDate: '2026-12-31', noticeDays: 60 }, 'ok'], // deadline 2026-11-01
    [{ endDate: '2026-12-31', noticeDays: 70 }, 'soon'], // deadline 2026-10-22
    [{ endDate: '2026-10-05', noticeDays: 30 }, 'soon'], // deadline passed, end within 30 days
    [{ endDate: '2026-09-29', noticeDays: 0 }, 'act-now'], // last day today
  ])('status of %j is %s', (over, state) => {
    expect(statusOf(doc(over), '2026-09-29')).toBe(state);
  });

  it('points to the deadline while ahead, otherwise to the end', () => {
    const today = '2026-09-29';
    expect(nextRelevantDate(doc({ endDate: '2026-12-31', noticeDays: 90 }), today)).toBe(
      '2026-10-02',
    );
    expect(nextRelevantDate(doc({ endDate: '2026-10-05', noticeDays: 30 }), today)).toBe(
      '2026-10-05',
    );
    expect(nextRelevantDate(doc(), today)).toBeUndefined();
  });

  it('filters and sorts', () => {
    const list = [
      doc({ title: 'Zeugnis' }),
      doc({ title: 'Police', category: 'insurance', endDate: '2027-01-01' }),
      doc({
        title: 'Ausweis',
        category: 'identity',
        endDate: '2026-10-01',
        fileName: 'Personalausweis.pdf',
      }),
      doc({ title: 'Abgelaufen', endDate: '2026-01-01' }),
      doc({ title: 'Kündigen', endDate: '2026-12-31', noticeDays: 90 }),
    ];
    // act now, expired, soon, ok, open-ended
    expect(sortDocuments(list, '2026-09-29').map((d) => d.title)).toEqual([
      'Kündigen',
      'Abgelaufen',
      'Ausweis',
      'Police',
      'Zeugnis',
    ]);
    expect(filterDocuments(list, { category: 'insurance', query: '' })).toHaveLength(1);
    expect(filterDocuments(list, { category: 'all', query: 'personalausweis' })).toHaveLength(1);
    expect(filterDocuments(list, { category: 'all', query: '' })).toHaveLength(5);
    expect(safeFileName('a/b:c?.pdf')).toBe('a_b_c_.pdf');
  });
});

describe('local blobs', () => {
  it('stores, reads back and prunes files', async () => {
    await putBlob('a', new Blob(['hello'], { type: 'text/plain' }));
    await putBlob('b', new Blob(['x']));
    const blob = await getBlob('a');
    expect(blob?.type).toBe('text/plain');
    expect(blob?.size).toBe(5);
    expect(await getBlob('missing')).toBeUndefined();
    expect(await pruneBlobs(new Set(['a']))).toBe(1);
    expect(await blobKeys()).toEqual(['a']);
  });

  it('never enters the sync outbox', async () => {
    await putBlob('a', new Blob(['secret']));
    expect(await db.table('_outbox').count()).toBe(0);
  });
});

describe('vault module', () => {
  it('has a valid manifest and is off by default', () => {
    expect(validateManifest(manifest)).toEqual([]);
    expect(manifest.defaultEnabled).toBe(false);
  });

  it('saves metadata through the repo and the file locally, and can replace or remove it', async () => {
    const file = new File(['pdf-bytes'], 'pass.pdf', { type: 'application/pdf' });
    const id = await saveDocument(null, doc(), file);
    expect(await documentRepo.get(id)).toMatchObject({
      fileName: 'pass.pdf',
      fileType: 'application/pdf',
      fileSize: 9,
    });
    expect((await getBlob(id))?.size).toBe(9);
    expect(await db.table('_outbox').get(['vault_document', id])).toBeDefined();

    await saveDocument(id, { ...doc(), title: 'Reisepass neu', fileName: 'pass.pdf' }); // no file change
    expect((await getBlob(id))?.size).toBe(9);

    await saveDocument(id, doc(), 'remove');
    expect(await getBlob(id)).toBeUndefined();
    expect((await documentRepo.get(id))?.fileName).toBeUndefined();
  });

  it('deleting a document deletes its file', async () => {
    const id = await saveDocument(null, doc(), new File(['x'], 'x.txt'));
    await deleteDocument(id);
    expect(await documentRepo.get(id)).toBeUndefined();
    expect(await getBlob(id)).toBeUndefined();
  });

  it('shows end and cancellation deadline on the calendar', async () => {
    await documentRepo.create(doc({ endDate: '2026-12-31', noticeDays: 90 }));
    await documentRepo.create(doc({ title: 'Pass', expiresOn: '2026-11-15' })); // legacy field
    await documentRepo.create(doc({ title: 'ohne Ende' }));
    const items = await collectCalendarItems({ from: '2026-09-01', to: '2026-12-31' }, [manifest]);
    expect(items.map((i) => [i.date, i.kind]).sort()).toEqual([
      ['2026-10-02', 'cancel'],
      ['2026-11-15', 'end'],
      ['2026-12-31', 'end'],
    ]);
  });

  it('reminds ahead of the end (30 days) and of the deadline (14 days), once each', async () => {
    await documentRepo.create(doc({ endDate: '2026-12-01' }));
    const end = toEpoch('2026-11-01', '09:00');
    expect(await collectNotifications({ from: end - 1, to: end + 1 }, [manifest])).toHaveLength(1);

    await documentRepo.create(doc({ title: 'Vertrag', endDate: '2026-12-31', noticeDays: 90 }));
    const deadline = toEpoch('2026-09-18', '09:00'); // 14 days before 2026-10-02
    const found = await collectNotifications({ from: deadline - 1000, to: deadline + 1000 }, [
      manifest,
    ]);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      at: deadline,
      key: expect.stringContaining('2026-10-02') as string,
    });
    expect(
      await collectNotifications({ from: deadline + 1000, to: deadline + 86_400_000 }, [manifest]),
    ).toEqual([]);
  });

  it('the 0.6.0 migration moves expiresOn to endDate', async () => {
    const created = await documentRepo.create(doc({ expiresOn: '2026-12-01' }));
    await db.table('_meta').put({ key: 'moduleVersion.vault', value: 1 });
    await runMigrations(manifest);
    const row = await documentRepo.get(created.id);
    expect(row?.endDate).toBe('2026-12-01');
    expect(row?.expiresOn).toBeUndefined();
  });

  it('editing a legacy document writes endDate only', async () => {
    const created = await documentRepo.create(doc({ expiresOn: '2026-12-01' }));
    await saveDocument(created.id, { ...(await documentRepo.get(created.id))!, title: 'Neu' });
    const row = await documentRepo.get(created.id);
    expect(row).toMatchObject({ title: 'Neu', endDate: '2026-12-01' });
    expect(row?.expiresOn).toBeUndefined();
  });
});
