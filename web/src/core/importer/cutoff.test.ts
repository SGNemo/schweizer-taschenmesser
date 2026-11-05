import { beforeEach, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import { getManifest } from '@/core/modules/registry';
import type * as RepoModule from '@/core/db/repo';
import type { PreviewRow } from './types';

// The tab is closed while the tasks are being written: simulated by a write that never ends.
const hang = { on: false };
vi.mock('@/core/db/repo', async (orig) => {
  const real = await orig<typeof RepoModule>();
  return {
    ...real,
    createCollectionRepo: (...args: Parameters<typeof real.createCollectionRepo>) => {
      const repo = real.createCollectionRepo(...args);
      return hang.on && args[1] === 'task'
        ? { ...repo, createMany: () => new Promise<never>(() => {}) }
        : repo;
    },
  };
});

const { commitImport, undoImport } = await import('./batches');
const todos = getManifest('todos')!;

beforeEach(async () => {
  hang.on = false;
  for (const t of ['todos_task', 'todos_list', '_imports', '_outbox']) await db.table(t).clear();
});

const rows = [
  {
    selected: true,
    candidate: { collection: 'list', data: { name: 'Umzug', order: 1 }, label: 'Umzug', id: 'L1' },
  },
  {
    selected: true,
    candidate: {
      collection: 'task',
      data: { listId: 'L1', title: 'Kartons', done: false, priority: 0, order: 0 },
      label: 'Kartons',
      dependsOn: 'L1',
    },
  },
] as unknown as PreviewRow[];

// QA round 4, X11: the batch row was written only after all records, so an import cut off half way
// left records behind that "Import rückgängig" could not reach.
it('an import cut off half way can still be undone', async () => {
  hang.on = true;
  void commitImport(todos, { batchId: 'cut', importerId: 'text', source: 'Text', rows });
  await vi.waitFor(async () => expect(await db.table('todos_list').get('L1')).toBeDefined());
  hang.on = false; // the app is opened again

  const batch = await db.table('_imports').get('cut');
  expect(batch?.status).toBe('committed');
  await undoImport(todos, 'cut');
  expect((await db.table('todos_list').get('L1'))?.deletedAt).not.toBeNull();
});

it('a finished import records exactly what it wrote, never a record that existed before', async () => {
  await db.table('todos_list').put({
    id: 'L1',
    name: 'Alt',
    order: 0,
    createdAt: 1,
    updatedAt: 1,
    deviceId: 'd',
    deletedAt: null,
    _f: {},
  });
  const batch = await commitImport(todos, {
    batchId: 'b2',
    importerId: 'text',
    source: 'Text',
    rows,
  });
  expect(batch.records.find((r) => r.collection === 'list')?.ids).toEqual([]);
  expect(batch.records.find((r) => r.collection === 'task')?.ids).toHaveLength(1);
});
