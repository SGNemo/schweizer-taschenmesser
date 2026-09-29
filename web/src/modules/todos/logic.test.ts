import { describe, expect, it } from 'vitest';
import { compareTasks, dueTone, groupTasks } from './logic';

const t = (
  over: Partial<Parameters<typeof compareTasks>[0]> & { id?: string; parentId?: string },
) => ({
  id: 'x',
  done: false,
  priority: 0,
  order: 0,
  createdAt: 1,
  ...over,
});

describe('todo logic', () => {
  it('sorts open before done, then due date, priority, order', () => {
    const list = [
      t({ id: 'done', done: true, dueDate: '2026-01-01' }),
      t({ id: 'nodate', priority: 3 }),
      t({ id: 'late', dueDate: '2026-02-01' }),
      t({ id: 'early-low', dueDate: '2026-01-01', priority: 1 }),
      t({ id: 'early-high', dueDate: '2026-01-01', priority: 3 }),
    ].sort(compareTasks);
    expect(list.map((x) => x.id)).toEqual(['early-high', 'early-low', 'late', 'nodate', 'done']);
  });

  it('falls back to manual order, then creation time', () => {
    const list = [
      t({ id: 'b', order: 2 }),
      t({ id: 'a', order: 1 }),
      t({ id: 'c', order: 2, createdAt: 0 }),
    ].sort(compareTasks);
    expect(list.map((x) => x.id)).toEqual(['a', 'c', 'b']);
  });

  it('groups subtasks under their parent and keeps orphans on top level', () => {
    const tasks = [
      t({ id: 'p', order: 1 }),
      t({ id: 's2', parentId: 'p', order: 2 }),
      t({ id: 's1', parentId: 'p', order: 1 }),
      t({ id: 'orphan', parentId: 'gone', order: 3 }),
    ];
    const g = groupTasks(tasks);
    expect(g.top.map((x) => x.id)).toEqual(['p', 'orphan']);
    expect(g.children.get('p')?.map((x) => x.id)).toEqual(['s1', 's2']);
  });

  it('classifies due dates', () => {
    expect(dueTone(undefined, false, '2026-05-10')).toBe('none');
    expect(dueTone('2026-05-09', false, '2026-05-10')).toBe('overdue');
    expect(dueTone('2026-05-09', true, '2026-05-10')).toBe('later');
    expect(dueTone('2026-05-10', false, '2026-05-10')).toBe('today');
    expect(dueTone('2026-05-12', false, '2026-05-10')).toBe('soon');
    expect(dueTone('2026-06-01', false, '2026-05-10')).toBe('later');
  });
});
