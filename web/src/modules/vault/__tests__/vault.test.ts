import { beforeEach, describe, expect, it } from 'vitest';
import { blobKeys, getBlob, pruneBlobs, putBlob } from '@/core/blobs';
import { db } from '@/core/db/db';
import { collectCalendarItems, collectNotifications } from '@/core/modules/contributions';
import { validateManifest } from '@/core/modules/registry';
import { toEpoch } from '@/core/time/dates';
import { expiryState, filterDocuments, formatSize, safeFileName, sortDocuments } from '../logic';
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

  it.each([
    [{}, 'none'],
    [{ expiresOn: '2026-09-28' }, 'expired'],
    [{ expiresOn: '2026-09-29' }, 'soon'],
    [{ expiresOn: '2026-11-28' }, 'soon'], // 60 days
    [{ expiresOn: '2026-11-29' }, 'ok'],
  ])('expiry of %j is %s', (over, state) => {
    expect(expiryState(doc(over), '2026-09-29')).toBe(state);
  });

  it('filters and sorts', () => {
    const list = [
      doc({ title: 'Zeugnis' }),
      doc({ title: 'Police', category: 'insurance', expiresOn: '2027-01-01' }),
      doc({
        title: 'Ausweis',
        category: 'identity',
        expiresOn: '2026-10-01',
        fileName: 'Personalausweis.pdf',
      }),
    ];
    expect(sortDocuments(list).map((d) => d.title)).toEqual(['Ausweis', 'Police', 'Zeugnis']);
    expect(filterDocuments(list, { category: 'insurance', query: '' })).toHaveLength(1);
    expect(filterDocuments(list, { category: 'all', query: 'personalausweis' })).toHaveLength(1);
    expect(filterDocuments(list, { category: 'all', query: '' })).toHaveLength(3);
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

  it('shows expiry on the calendar and reminds ahead', async () => {
    await documentRepo.create(doc({ expiresOn: '2026-12-01' }));
    const items = await collectCalendarItems({ from: '2026-11-01', to: '2026-12-31' }, [manifest]);
    expect(items.map((i) => [i.date, i.kind])).toEqual([['2026-12-01', 'expiry']]);
    const at = toEpoch('2026-11-01', '09:00'); // 30 days before
    const found = await collectNotifications({ from: at - 1, to: at + 1 }, [manifest]);
    expect(found).toHaveLength(1);
  });
});
