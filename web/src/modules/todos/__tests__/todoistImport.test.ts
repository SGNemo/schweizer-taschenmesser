import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { commitImport } from '@/core/importer/batches';
import { toggleRow } from '@/core/importer/ImportPreview';
import { buildPreview } from '@/core/importer/plan';
import runtime from '../importer';
import manifest from '../manifest';
import { INBOX_ID, listRepo, taskRepo } from '../repo';

const TODAY = '2026-11-05';
const CSV = [
  'TYPE,CONTENT,DESCRIPTION,PRIORITY,INDENT,AUTHOR,RESPONSIBLE,DATE,DATE_LANG,TIMEZONE',
  'task,Steuer,,4,1,,,,en,',
  'task,Belege sammeln,,1,2,,,2026-11-01,en,',
].join('\n');

async function preview(batchId: string) {
  const parsed = await runtime.parse(
    'file',
    { kind: 'file', text: CSV, fileName: 'Inbox.csv' },
    { today: TODAY, options: { fileList: INBOX_ID }, batchId },
  );
  return buildPreview(manifest, runtime, parsed.candidates);
}

beforeEach(async () => {
  await db.table('todos_task').clear();
  await db.table('todos_list').clear();
  await db.table('_imports').clear();
  await listRepo.create({ name: 'Inbox', order: 0 }, { id: INBOX_ID });
});

describe('Todoist import: subtasks never point at a task that is not written (X12)', () => {
  it('hangs a subtask under the existing task when its parent is a duplicate', async () => {
    const existing = await taskRepo.create({
      listId: INBOX_ID,
      title: 'Steuer',
      done: false,
      priority: 0,
      order: 0,
    });
    const rows = await preview('b1');
    expect(rows.find((r) => r.candidate.label === 'Steuer')?.duplicate).toBe(true);
    await commitImport(manifest, { batchId: 'b1', importerId: 'file', source: 'Inbox.csv', rows });
    const tasks = await taskRepo.active().toArray();
    expect(tasks).toHaveLength(2);
    expect(tasks.find((x) => x.title === 'Belege sammeln')?.parentId).toBe(existing.id);
  });

  it('ties a subtask to its new parent: unticking the parent leaves the subtask out', async () => {
    const rows = await preview('b2');
    const parent = rows.find((r) => r.candidate.label === 'Steuer')!;
    const sub = rows.find((r) => r.candidate.label === 'Belege sammeln')!;
    expect(sub.candidate.dependsOn).toBe(parent.candidate.id);
    expect(sub.candidate.data.parentId).toBe(parent.candidate.id);
    const without = toggleRow(rows, parent.index, false);
    expect(without.find((r) => r.index === sub.index)?.selected).toBe(false);
  });
});
