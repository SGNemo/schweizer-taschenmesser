import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { bus } from '@/core/events';
import { taskRepo } from '../repo';
import start from '../services';

beforeEach(async () => {
  await db.table('todos_task').clear();
  await db.table('todos_list').clear();
  bus.clear();
});

describe('todo.requested', () => {
  it('adds the requested to-do to the first list, creating the inbox when there is none', async () => {
    const stop = start();
    await bus.emit('todo.requested', { title: '  Milch kaufen ' });
    await bus.emit('todo.requested', { title: '   ' });
    const tasks = await taskRepo.active().toArray();
    expect(tasks.map((x) => x.title)).toEqual(['Milch kaufen']);
    stop();
    await bus.emit('todo.requested', { title: 'Brot' });
    expect(await taskRepo.active().count()).toBe(1);
  });

  it('carries an optional due date (from a calendar event)', async () => {
    const stop = start();
    await bus.emit('todo.requested', { title: 'Zahnarzt vorbereiten', dueDate: '2026-11-10' });
    const [task] = await taskRepo.active().toArray();
    expect(task?.dueDate).toBe('2026-11-10');
    stop();
  });

  it('keeps the link to the place it came from', async () => {
    const stop = start();
    await bus.emit('todo.requested', {
      title: 'Zahnarzt vorbereiten',
      link: { kind: 'event', id: 'ev1', label: 'Zahnarzt' },
    });
    const [task] = await taskRepo.active().toArray();
    expect(task?.links).toEqual([{ kind: 'event', id: 'ev1', label: 'Zahnarzt' }]);
    stop();
  });
});
