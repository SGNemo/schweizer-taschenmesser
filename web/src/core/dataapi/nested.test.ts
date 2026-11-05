import { beforeEach, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { commitImport } from '@/core/importer/batches';
import { buildPreview } from '@/core/importer/plan';
import { getManifest } from '@/core/modules/registry';
import { INBOX_ID, listRepo, taskRepo } from '@/modules/todos/repo';
import { createJsonRuntime } from './importer';

const todos = getManifest('todos')!;

beforeEach(async () => {
  for (const t of ['todos_task', 'todos_list', '_imports', '_outbox']) await db.table(t).clear();
  await listRepo.create({ name: 'Inbox', order: 0 }, { id: INBOX_ID });
});

async function importJson(items: unknown[], batchId: string) {
  const runtime = createJsonRuntime(todos);
  const parsed = await runtime.parse(
    'json',
    { kind: 'json', text: JSON.stringify(items) },
    { today: '2026-11-05', options: {}, batchId },
  );
  const rows = await buildPreview(todos, runtime, parsed.candidates);
  if (rows.some((r) => r.selected && !r.invalid))
    await commitImport(todos, { batchId, importerId: 'json', source: 'test', rows });
  return rows;
}

// QA round 4, X09: a parent that is itself a subtask, or a cycle in the batch, made tasks vanish
// (the list shows two levels only).
it('rejects a parent that is a subtask itself, and parent cycles', async () => {
  const p = await taskRepo.create({
    listId: INBOX_ID,
    title: 'Umzug',
    done: false,
    priority: 0,
    order: 0,
  });
  await taskRepo.create({
    listId: INBOX_ID,
    title: 'Kartons',
    done: false,
    priority: 0,
    order: 1,
    parentId: p.id,
  });
  const rows = await importJson(
    [
      { collection: 'task', key: 'a', title: 'Zyklus A', listId: INBOX_ID, parentId: '@b' },
      { collection: 'task', key: 'b', title: 'Zyklus B', listId: INBOX_ID, parentId: '@a' },
      { collection: 'task', title: 'Klebeband', listId: INBOX_ID, parentId: 'Kartons' },
      { collection: 'task', title: 'Kleber', listId: INBOX_ID, parentId: 'Umzug' },
    ],
    'j3',
  );
  expect(rows.filter((r) => r.invalid).map((r) => r.candidate.label)).toEqual([
    'Zyklus A',
    'Zyklus B',
    'Klebeband',
  ]);
  expect((await taskRepo.active().toArray()).map((t) => t.title).sort()).toEqual([
    'Kartons',
    'Kleber',
    'Umzug',
  ]);
});

it('a change to a subtask in the same batch is no valid parent either', async () => {
  const p = await taskRepo.create({
    listId: INBOX_ID,
    title: 'Umzug',
    done: false,
    priority: 0,
    order: 0,
  });
  const sub = await taskRepo.create({
    listId: INBOX_ID,
    title: 'Kartons',
    done: false,
    priority: 0,
    order: 1,
    parentId: p.id,
  });
  const rows = await importJson(
    [
      { collection: 'task', key: 'k', id: sub.id, title: 'Kartons groß' },
      { collection: 'task', title: 'Klebeband', listId: INBOX_ID, parentId: '@k' },
    ],
    'j4',
  );
  expect(rows.find((r) => r.candidate.label === 'Klebeband')?.invalid).toBeTruthy();
});

it('a subtask turned into a task in the same batch can take subtasks', async () => {
  const p = await taskRepo.create({
    listId: INBOX_ID,
    title: 'Umzug',
    done: false,
    priority: 0,
    order: 0,
  });
  const sub = await taskRepo.create({
    listId: INBOX_ID,
    title: 'Kartons',
    done: false,
    priority: 0,
    order: 1,
    parentId: p.id,
  });
  const rows = await importJson(
    [
      { collection: 'task', key: 'k', id: sub.id, parentId: null },
      { collection: 'task', title: 'Klebeband', listId: INBOX_ID, parentId: '@k' },
    ],
    'j7',
  );
  expect(rows.find((r) => r.candidate.label === 'Klebeband')?.invalid).toBeUndefined();
});
