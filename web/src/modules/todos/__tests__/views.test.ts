import { describe, expect, it } from 'vitest';
import { movePatch, overdueTasks, viewOf } from '../views';
import { normalizeTag, parseTags, tagCounts } from '../tags';

const DAY = '2026-11-03';
const t = (over: Record<string, unknown> = {}) => ({ done: false, ...over }) as never;

describe('viewOf', () => {
  it('sorts by state and date', () => {
    expect(viewOf(t({ done: true }), DAY)).toBe('done');
    expect(viewOf(t({ someday: true, dueDate: DAY }), DAY)).toBe('someday');
    expect(viewOf(t(), DAY)).toBe('someday');
    expect(viewOf(t({ dueDate: DAY }), DAY)).toBe('today');
    expect(viewOf(t({ dueDate: '2026-10-01' }), DAY)).toBe('today');
    expect(viewOf(t({ plannedFor: DAY }), DAY)).toBe('today');
    expect(viewOf(t({ dueDate: '2026-11-10' }), DAY)).toBe('soon');
  });

  it('keeps a task with a later start date out of today', () => {
    expect(viewOf(t({ dueDate: DAY, startDate: '2026-11-05' }), DAY)).toBe('soon');
    expect(viewOf(t({ dueDate: DAY, startDate: DAY }), DAY)).toBe('today');
  });
});

describe('movePatch', () => {
  it('moves into today, reopening and clearing someday', () => {
    expect(movePatch(t({ someday: true, done: true }), 'today', DAY)).toMatchObject({
      done: false,
      someday: undefined,
      plannedFor: DAY,
    });
    expect(movePatch(t({ startDate: '2026-11-09' }), 'today', DAY).startDate).toBe(DAY);
  });

  it('moves into soon: tomorrow, a plan further ahead stays, a due date of today moves too', () => {
    const p = movePatch(t({ dueDate: DAY }), 'soon', DAY);
    expect(p.plannedFor).toBe('2026-11-04');
    expect(p.dueDate).toBe('2026-11-04');
    expect(movePatch(t({ plannedFor: '2026-11-20' }), 'soon', DAY).plannedFor).toBe('2026-11-20');
  });

  it('moves into someday: flag on, plan off', () => {
    expect(movePatch(t({ plannedFor: DAY }), 'someday', DAY)).toMatchObject({
      someday: true,
      plannedFor: undefined,
    });
  });
});

describe('overdueTasks', () => {
  it('only open, dated before today, top-level, not someday', () => {
    const list = [
      { id: 'a', done: false, dueDate: '2026-11-01' },
      { id: 'b', done: true, dueDate: '2026-11-01' },
      { id: 'c', done: false, dueDate: DAY },
      { id: 'd', done: false, dueDate: '2026-10-01', parentId: 'a' },
      { id: 'e', done: false, dueDate: '2026-10-01', someday: true },
    ] as never[];
    expect(overdueTasks(list, DAY).map((x: { id: string }) => x.id)).toEqual(['a']);
  });
});

describe('tags', () => {
  it('normalises and splits', () => {
    expect(normalizeTag(' #Einkauf ')).toBe('einkauf');
    expect(parseTags('Haus, #Garten  haus')).toEqual(['haus', 'garten']);
  });
  it('counts open tasks per tag', () => {
    expect(
      tagCounts([
        { tags: ['a', 'b'], done: false },
        { tags: ['b'], done: false },
        { tags: ['a'], done: true },
      ]),
    ).toEqual([
      ['b', 2],
      ['a', 1],
    ]);
  });
});
