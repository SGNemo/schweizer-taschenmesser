import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { collectCalendarItems } from '@/core/modules/contributions';
import manifest from '../manifest';
import { deleteList, deleteTask, ensureInbox, INBOX_ID, listRepo, taskRepo } from '../repo';
import { listSchema, taskSchema } from '../schema';

const base = { done: false, priority: 0, order: 0 };

beforeEach(async () => {
  await db.table('todos_task').clear();
  await db.table('todos_list').clear();
});

describe('todos module', () => {
  it('validates tasks', () => {
    expect(taskSchema.safeParse({ listId: 'l', title: '' }).success).toBe(false);
    expect(taskSchema.safeParse({ listId: 'l', title: 'x', dueDate: '5.5.2026' }).success).toBe(
      false,
    );
    expect(taskSchema.safeParse({ listId: 'l', title: 'x', priority: 4 }).success).toBe(false);
    expect(taskSchema.parse({ listId: 'l', title: 'x' })).toMatchObject({
      done: false,
      priority: 0,
    });
    expect(listSchema.parse({ name: 'A' }).order).toBe(0);
  });

  it('validates the optional plan and estimate fields', () => {
    const ok = taskSchema.safeParse({
      listId: 'l',
      title: 'x',
      plannedFor: '2026-10-02',
      estimateMin: 15,
    });
    expect(ok.success).toBe(true);
    expect(taskSchema.safeParse({ listId: 'l', title: 'x', estimateMin: 0 }).success).toBe(false);
    expect(taskSchema.safeParse({ listId: 'l', title: 'x', estimateMin: 1.5 }).success).toBe(false);
    expect(taskSchema.safeParse({ listId: 'l', title: 'x', plannedFor: 'heute' }).success).toBe(
      false,
    );
    // Old records without the fields stay valid.
    expect(taskSchema.safeParse({ listId: 'l', title: 'x' }).success).toBe(true);
  });

  it('contributes tasks with a due date inside the range to the calendar', async () => {
    await taskRepo.create({ ...base, listId: 'l', title: 'in', dueDate: '2026-05-10' });
    await taskRepo.create({ ...base, listId: 'l', title: 'out', dueDate: '2026-07-10' });
    await taskRepo.create({ ...base, listId: 'l', title: 'nodate' });
    const gone = await taskRepo.create({
      ...base,
      listId: 'l',
      title: 'deleted',
      dueDate: '2026-05-11',
    });
    await taskRepo.remove(gone.id);

    const items = await collectCalendarItems({ from: '2026-05-01', to: '2026-05-31' }, [manifest]);
    expect(items).toEqual([
      expect.objectContaining({
        title: 'in',
        date: '2026-05-10',
        kind: 'task',
        source: 'todos',
        allDay: true,
      }),
    ]);
  });

  it('ensureInbox creates one list, is idempotent and revives a deleted inbox', async () => {
    await ensureInbox('Eingang');
    await ensureInbox('Eingang');
    expect(await listRepo.active().count()).toBe(1);
    await listRepo.remove(INBOX_ID);
    await ensureInbox('Eingang');
    expect((await listRepo.get(INBOX_ID))?.name).toBe('Eingang');
  });

  it('deleteTask removes subtasks too; deleteList removes its tasks', async () => {
    const list = await listRepo.create({ name: 'L', order: 1 });
    const parent = await taskRepo.create({ ...base, listId: list.id, title: 'p' });
    await taskRepo.create({ ...base, listId: list.id, title: 's', parentId: parent.id });
    const other = await taskRepo.create({ ...base, listId: list.id, title: 'o' });
    await deleteTask(parent.id);
    expect((await taskRepo.active().toArray()).map((t) => t.id)).toEqual([other.id]);
    await deleteList(list.id);
    expect(await taskRepo.active().count()).toBe(0);
    expect(await listRepo.active().count()).toBe(0);
  });
});
