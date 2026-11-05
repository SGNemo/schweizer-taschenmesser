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

const orphans = async () => {
  const lists = new Set((await listRepo.active().toArray()).map((l) => l.id));
  const tasks = await taskRepo.active().toArray();
  const ids = new Set(tasks.map((t) => t.id));
  return tasks
    .filter((t) => !lists.has(t.listId) || (t.parentId !== undefined && !ids.has(t.parentId)))
    .map((t) => t.title);
};

// QA round 4, X08: a task pointing (`@key`) at a list of the batch that is not written (a duplicate
// or an invalid row) was stored in a list that does not exist, so nobody ever saw it.
it('a task is never written without the list of the batch it points at', async () => {
  await listRepo.create({ name: 'Urlaub', order: 1 }, { id: 'urlaub' });
  await importJson(
    [
      { collection: 'list', key: 'u', name: 'Urlaub' },
      { collection: 'task', title: 'Pass verlängern', listId: '@u' },
      { collection: 'list', key: 'bad', name: '' },
      { collection: 'task', title: 'Koffer', listId: '@bad' },
    ],
    'j1',
  );
  expect(await orphans()).toEqual([]);
});

it('writes a new list and its task together; a change to a list is no dependency', async () => {
  await listRepo.create({ name: 'Urlaub', order: 1 }, { id: 'urlaub' });
  const rows = await importJson(
    [
      { collection: 'list', key: 'n', name: 'Umzug' },
      { collection: 'task', title: 'Kartons', listId: '@n' },
      { collection: 'list', id: 'urlaub', name: 'Urlaub 2027' },
      { collection: 'task', title: 'Pass', listId: 'urlaub' },
    ],
    'j2',
  );
  expect(rows.filter((r) => r.selected).map((r) => r.candidate.label)).toEqual([
    'Umzug',
    'Kartons',
    'Pass',
  ]);
  const tasks = await taskRepo.active().toArray();
  expect(tasks.map((t) => t.title).sort()).toEqual(['Kartons', 'Pass']);
  expect(await orphans()).toEqual([]);
});

it('a subtask is not written when its parent is left out because of its list', async () => {
  const runtime = createJsonRuntime(todos);
  const parsed = await runtime.parse(
    'json',
    {
      kind: 'json',
      text: JSON.stringify([
        { collection: 'list', key: 'l', name: 'Umzug' },
        { collection: 'task', key: 'p', title: 'Packen', listId: '@l' },
        { collection: 'task', title: 'Kartons', listId: '@l', parentId: '@p' },
        { collection: 'task', title: 'Einzeln', listId: INBOX_ID },
      ]),
    },
    { today: '2026-11-05', options: {}, batchId: 'j5' },
  );
  const rows = await buildPreview(todos, runtime, parsed.candidates);
  // The user unticks only the new list.
  const unticked = rows.map((r) => (r.candidate.label === 'Umzug' ? { ...r, selected: false } : r));
  await commitImport(todos, { batchId: 'j5', importerId: 'json', source: 'test', rows: unticked });
  expect((await taskRepo.active().toArray()).map((t) => t.title)).toEqual(['Einzeln']);
});

it('a task pointing at a change of an unknown list is not written', async () => {
  await importJson(
    [
      { collection: 'list', key: 'x', id: 'nope', name: 'Garten' },
      { collection: 'task', title: 'Rasen', listId: '@x' },
      { collection: 'task', title: 'Einzeln', listId: INBOX_ID },
    ],
    'j6',
  );
  expect((await taskRepo.active().toArray()).map((t) => t.title)).toEqual(['Einzeln']);
});

it('an entry of another collection with the same id is no dependency (and nothing throws)', async () => {
  const rows = await importJson(
    [
      { collection: 'lists', id: INBOX_ID },
      { collection: 'task', id: INBOX_ID, title: 'kein Eintrag' },
      { collection: 'task', title: 'Einzeln', listId: INBOX_ID },
    ],
    'j8',
  );
  expect(rows.find((r) => r.candidate.label === 'Einzeln')?.selected).toBe(true);
  expect((await taskRepo.active().toArray()).map((t) => t.title)).toEqual(['Einzeln']);
});
