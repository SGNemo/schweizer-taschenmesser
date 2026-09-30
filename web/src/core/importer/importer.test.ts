import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { getManifest } from '@/core/modules/registry';
import { setNow } from '@/core/time/now';
import { INBOX_ID, listRepo, taskRepo } from '@/modules/todos/repo';
import {
  commitImport,
  countRecords,
  listBatches,
  markOnboardingHandled,
  undoImport,
  wasOnboardingHandled,
} from './batches';
import { buildPreview, ImportError } from './plan';
import type { ImportCandidate, ImporterRuntime } from './types';

const todos = getManifest('todos')!;
const runtime: ImporterRuntime = {
  parse: () => ({ candidates: [], notes: [] }),
  existingKeys: async () =>
    new Set((await taskRepo.active().toArray()).map((task) => task.title.toLowerCase())),
};

const task = (title: string): ImportCandidate => ({
  collection: 'task',
  data: { listId: INBOX_ID, title },
  label: title,
  dedupeKey: title.toLowerCase(),
});

let clock = 1_700_000_000_000;

beforeEach(async () => {
  clock = 1_700_000_000_000;
  setNow(() => clock);
  for (const table of ['todos_task', 'todos_list', '_imports', '_outbox', '_meta'])
    await db.table(table).clear();
  await listRepo.create({ name: 'Inbox', order: 0 }, { id: INBOX_ID });
});
afterEach(() => setNow());

describe('buildPreview', () => {
  it('ticks new rows and unticks duplicates (stored and repeated) and invalid rows', async () => {
    await taskRepo.create({
      listId: INBOX_ID,
      title: 'Vorhanden',
      done: false,
      priority: 0,
      order: 0,
    });
    const rows = await buildPreview(todos, runtime, [
      task('Neu'),
      task('vorhanden'),
      task('Neu'),
      { ...task('Kaputt'), data: { listId: INBOX_ID, title: '' } },
    ]);
    expect(rows.map((r) => [r.duplicate, Boolean(r.invalid), r.selected])).toEqual([
      [false, false, true],
      [true, false, false],
      [true, false, false],
      [false, true, false],
    ]);
    expect(rows[3]!.invalid).toMatch(/title/);
  });

  it('refuses a candidate for a collection the module does not have', async () => {
    await expect(
      buildPreview(todos, runtime, [{ ...task('x'), collection: 'nope' }]),
    ).rejects.toBeInstanceOf(ImportError);
  });

  it('does not store anything', async () => {
    await buildPreview(todos, runtime, [task('A'), task('B')]);
    expect(await taskRepo.active().count()).toBe(0);
    expect(await db.table('_imports').count()).toBe(0);
  });
});

describe('commitImport / undoImport', () => {
  async function importTasks(titles: string[], batchId = 'b1') {
    const rows = await buildPreview(todos, runtime, titles.map(task));
    return commitImport(todos, { batchId, importerId: 'text', source: 'Text', rows });
  }

  it('writes only the ticked rows, with batch ids, and records the batch', async () => {
    const rows = await buildPreview(todos, runtime, [task('A'), task('B'), task('C')]);
    rows[1]!.selected = false;
    const batch = await commitImport(todos, {
      batchId: 'b1',
      importerId: 'text',
      source: 'Text',
      rows,
    });
    expect(countRecords(batch)).toBe(2);
    expect((await taskRepo.active().toArray()).map((x) => x.title).sort()).toEqual(['A', 'C']);
    expect(batch.records[0]!.ids.every((id) => id.startsWith('imp-b1-'))).toBe(true);
    expect((await listBatches('todos'))[0]).toMatchObject({
      id: 'b1',
      importerId: 'text',
      source: 'Text',
    });
    // Imported records take part in sync like any other write.
    expect(await db.table('_outbox').count()).toBeGreaterThanOrEqual(3);
  });

  it('honours fixed candidate ids', async () => {
    const rows = await buildPreview(todos, runtime, [{ ...task('A'), id: 'fixed-1' }]);
    await commitImport(todos, { batchId: 'b1', importerId: 'text', source: 'Text', rows });
    expect(await taskRepo.get('fixed-1')).toBeDefined();
  });

  it('rejects an empty selection', async () => {
    const rows = await buildPreview(todos, runtime, [task('A')]);
    rows[0]!.selected = false;
    await expect(
      commitImport(todos, { batchId: 'b1', importerId: 'text', source: 'Text', rows }),
    ).rejects.toMatchObject({ code: 'nothing-selected' });
  });

  it('undo removes untouched records and keeps edited ones', async () => {
    const batch = await importTasks(['A', 'B', 'C']);
    const [a, b] = batch.records[0]!.ids as [string, string, string];
    clock += 1000;
    await taskRepo.update(b, { done: true }); // edited after the import
    const result = await undoImport(todos, 'b1');
    expect(result).toEqual({ removed: 2, kept: 1 });
    expect((await taskRepo.active().toArray()).map((x) => x.id)).toEqual([b]);
    expect(await taskRepo.get(a)).toBeUndefined();
    expect((await listBatches('todos'))[0]).toMatchObject({ keptOnUndo: 1 });
    expect((await listBatches('todos'))[0]!.undoneAt).toBeDefined();
  });

  it('undo tombstones (so the removal syncs) and is idempotent', async () => {
    const batch = await importTasks(['A']);
    const id = batch.records[0]!.ids[0]!;
    await undoImport(todos, 'b1');
    const stored = await taskRepo.table.get(id);
    expect(stored?.deletedAt).not.toBeNull();
    expect(await undoImport(todos, 'b1')).toEqual({ removed: 0, kept: 0 });
    expect(await undoImport(todos, 'unknown')).toEqual({ removed: 0, kept: 0 });
  });

  it('does not touch records the user deleted meanwhile', async () => {
    const batch = await importTasks(['A', 'B']);
    await taskRepo.remove(batch.records[0]!.ids[0]!);
    expect(await undoImport(todos, 'b1')).toEqual({ removed: 1, kept: 0 });
  });

  it('lists batches per module, newest first', async () => {
    await importTasks(['A'], 'first');
    clock += 5000;
    await importTasks(['B'], 'second');
    expect((await listBatches('todos')).map((b) => b.id)).toEqual(['second', 'first']);
    expect(await listBatches('finance')).toEqual([]);
  });
});

describe('onboarding flag', () => {
  it('remembers per module that the wizard was handled', async () => {
    expect(await wasOnboardingHandled('todos')).toBe(false);
    await markOnboardingHandled('todos');
    expect(await wasOnboardingHandled('todos')).toBe(true);
    expect(await wasOnboardingHandled('finance')).toBe(false);
  });
});
