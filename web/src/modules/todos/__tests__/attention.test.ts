import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { patchFocusSettings } from '@/core/settings/focus';
import attention from '../attention';
import { taskRepo } from '../repo';

const base = { listId: 'inbox', done: false, priority: 0, order: 0 };
const TODAY = '2026-10-02';

beforeEach(async () => {
  await db.table('todos_task').clear();
  await db.table('_settings').clear();
  await taskRepo.create({ ...base, title: 'alt 1', dueDate: '2026-09-01' });
  await taskRepo.create({ ...base, title: 'alt 2', dueDate: '2026-09-10' });
  await taskRepo.create({ ...base, title: 'heute', dueDate: TODAY });
  await taskRepo.create({ ...base, title: 'Irgendwann', dueDate: '2026-09-01', someday: true });
});

describe('todos attention', () => {
  it('calm (default): old ToDos are "waiting" in the warning tone, no red, no day counter', async () => {
    const items = await attention({ today: TODAY });
    expect(items.map((i) => [i.id, i.tone, i.title])).toEqual([
      ['todos:waiting', 'warning', '2 ToDos warten'],
      ['todos:today', 'accent', '1 ToDo heute fällig'],
    ]);
    expect(JSON.stringify(items)).not.toMatch(/überfällig|seit \d+ Tagen/);
  });

  it('classic when calm mode is off: overdue in the danger tone', async () => {
    await patchFocusSettings({ calmAttention: false });
    const items = await attention({ today: TODAY });
    expect(items.map((i) => [i.id, i.tone, i.title])).toEqual([
      ['todos:overdue', 'danger', '2 ToDos überfällig'],
      ['todos:today', 'accent', '1 ToDo heute fällig'],
    ]);
  });
});
