import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { getManifest } from '@/core/modules/registry';
import { setNow } from '@/core/time/now';
import { taskRepo } from '@/modules/todos/repo';
import { commitImport, recoverInterruptedImports } from './batches';
import type { ImportBatch, PreviewRow } from './types';

const manifest = getManifest('todos')!;
const imports = db.table<ImportBatch, string>('_imports');

const row = (collection: string, title: string, index: number): PreviewRow => ({
  index,
  duplicate: false,
  selected: true,
  candidate: {
    collection,
    data: collection === 'task' ? { listId: 'inbox', title } : { name: title },
    label: title,
    dedupeKey: `${collection}:${title}`,
  },
});

beforeEach(async () => {
  setNow(() => new Date(2026, 10, 4, 10, 0).getTime());
  for (const t of ['todos_task', 'todos_list', '_imports', '_outbox']) await db.table(t).clear();
});

describe('import commit leaves no half state', () => {
  it('a finished import is committed and leaves no marker', async () => {
    const batch = await commitImport(manifest, {
      batchId: 'ok1',
      importerId: 't',
      source: 'f',
      rows: [row('task', 'Brot', 0), row('task', 'Milch', 1)],
    });
    expect(batch.status).toBe('committed');
    expect((await imports.toArray()).map((b) => [b.id, b.status])).toEqual([['ok1', 'committed']]);
    expect(await db.table('todos_task').count()).toBe(2);
  });

  it('a failure after the first collection was written takes everything back and drops the marker', async () => {
    await expect(
      commitImport(manifest, {
        batchId: 'bad1',
        importerId: 't',
        source: 'f',
        rows: [row('task', 'Brot', 0), row('nope', 'x', 1)],
      }),
    ).rejects.toThrow();
    expect(
      await db
        .table('todos_task')
        .filter((r) => r.deletedAt === null)
        .count(),
    ).toBe(0);
    expect(await imports.count()).toBe(0);
  });

  it('a failing confirmation of a pending batch puts the pending batch back', async () => {
    const pending: Partial<ImportBatch> = {
      id: 'api1',
      moduleId: 'todos',
      importerId: 'api',
      source: 'api',
      createdAt: 1,
      records: [],
      status: 'pending',
      origin: 'api',
    };
    await imports.put(pending as ImportBatch);
    await expect(
      commitImport(manifest, {
        batchId: 'api1',
        importerId: 'api',
        source: 'api',
        base: pending,
        rows: [row('task', 'Brot', 0), row('nope', 'x', 1)],
      }),
    ).rejects.toThrow();
    expect((await imports.get('api1'))?.status).toBe('pending');
  });
});

describe('recoverInterruptedImports: the app was closed during an import', () => {
  const marker = (over: Partial<ImportBatch> = {}): ImportBatch => ({
    id: 'cut1',
    moduleId: 'todos',
    importerId: 't',
    source: 'f',
    createdAt: 5,
    records: [{ collection: 'task', ids: ['imp-cut1-0', 'imp-cut1-1', 'imp-cut1-2'] }],
    status: 'committing',
    ...over,
  });

  it('keeps the records that were written, registers them as a committed batch and says so', async () => {
    await taskRepo.create({ listId: 'inbox', title: 'a' } as never, { id: 'imp-cut1-0' });
    await taskRepo.create({ listId: 'inbox', title: 'b' } as never, { id: 'imp-cut1-1' });
    await imports.put(marker());
    expect(await recoverInterruptedImports()).toBe(1);
    const batch = (await imports.get('cut1'))!;
    expect(batch.status).toBe('committed');
    expect(batch.interrupted).toBe(true);
    expect(batch.records).toEqual([{ collection: 'task', ids: ['imp-cut1-0', 'imp-cut1-1'] }]);
    expect(await db.table('todos_task').count()).toBe(2); // nothing was removed
  });

  it('drops the marker of an import that wrote nothing', async () => {
    await imports.put(marker());
    await recoverInterruptedImports();
    expect(await imports.count()).toBe(0);
  });

  it('puts a pending batch that wrote nothing back to pending, with its rows', async () => {
    await imports.put(marker({ rows: [row('task', 'a', 0)] }));
    await recoverInterruptedImports();
    const batch = (await imports.get('cut1'))!;
    expect(batch.status).toBe('pending');
    expect(batch.rows).toHaveLength(1);
  });

  it('leaves finished batches alone and does nothing when nothing is stuck', async () => {
    await imports.put(marker({ status: 'committed' }));
    expect(await recoverInterruptedImports()).toBe(0);
    expect((await imports.get('cut1'))?.status).toBe('committed');
  });
});
