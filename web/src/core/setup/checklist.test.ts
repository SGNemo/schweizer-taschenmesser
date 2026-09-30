import { describe, expect, it } from 'vitest';
import { buildChecklist, showChecklist } from './checklist';
import { initialState } from './state';

const steps = [
  { id: 'a', title: 'A', since: 1 },
  { id: 'b', title: 'B', since: 1 },
  { id: 'c', title: 'C', since: 1 },
  { id: 'n', title: 'N', since: 2 },
];

describe('checklist', () => {
  it('counts done, skipped and open steps and flags new ones', () => {
    const state = { ...initialState('inProgress'), doneSteps: ['a'], skippedSteps: ['b'] };
    const list = buildChecklist(steps, state);
    expect(list).toMatchObject({ total: 4, done: 1 });
    expect(list.open.map((i) => [i.id, i.progress, i.isNew])).toEqual([
      ['b', 'skipped', false],
      ['c', 'open', false],
      ['n', 'open', true],
    ]);
  });

  it('detects steps that were finished elsewhere (e.g. a provider added in the settings)', () => {
    const list = buildChecklist(steps, initialState('dismissed'), new Set(['a', 'b']));
    expect(list.done).toBe(2);
    expect(list.open.map((i) => i.id)).toEqual(['c', 'n']);
  });

  it('shows for dismissed and in-progress setups, not before start, hidden, or when all is done', () => {
    const open = buildChecklist(steps, initialState());
    expect(showChecklist(initialState('dismissed'), open)).toBe(true);
    expect(showChecklist(initialState('inProgress'), open)).toBe(true);
    expect(showChecklist(initialState('notStarted'), open)).toBe(false);
    expect(showChecklist({ ...initialState('dismissed'), checklistHidden: true }, open)).toBe(
      false,
    );
    const all = buildChecklist(steps, initialState('completed'), new Set(steps.map((s) => s.id)));
    expect(showChecklist(initialState('completed'), all)).toBe(false);
  });

  it('offers steps of a newer release even after the setup was completed', () => {
    const state = { ...initialState('completed'), doneSteps: ['a', 'b', 'c'], version: 1 };
    const list = buildChecklist(steps, state);
    expect(showChecklist(state, list)).toBe(true);
    expect(list.open.map((i) => i.id)).toEqual(['n']);
  });
});
