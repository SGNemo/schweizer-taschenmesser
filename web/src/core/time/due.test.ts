import { describe, expect, it } from 'vitest';
import { dueState, dueTone } from './due';

const TODAY = '2026-09-29';

describe('dueTone', () => {
  it('keeps the existing rule', () => {
    expect(dueTone(undefined, false, TODAY)).toBe('none');
    expect(dueTone('2026-09-28', false, TODAY)).toBe('overdue');
    expect(dueTone('2026-09-28', true, TODAY)).toBe('later');
  });
});

describe('dueState', () => {
  it('marks past dates overdue with a "since" label', () => {
    expect(dueState('2026-09-26', TODAY)).toMatchObject({
      tone: 'overdue',
      days: -3,
      label: 'seit 3 Tagen',
    });
    expect(dueState('2026-09-28', TODAY).label).toBe('seit gestern');
  });
  it('highlights today', () => {
    expect(dueState(TODAY, TODAY)).toMatchObject({ tone: 'today', label: 'Heute' });
  });
  it('treats up to three days as soon and the rest as later', () => {
    expect(dueState('2026-09-30', TODAY)).toMatchObject({ tone: 'soon', label: 'Morgen' });
    expect(dueState('2026-10-02', TODAY)).toMatchObject({ tone: 'soon', label: 'in 3 Tagen' });
    expect(dueState('2026-10-03', TODAY).tone).toBe('later');
    expect(dueState('2026-10-03', TODAY, { soonDays: 5 }).tone).toBe('soon');
  });
  it('never calls finished items overdue', () => {
    expect(dueState('2026-09-20', TODAY, { done: true }).tone).toBe('later');
  });
});
