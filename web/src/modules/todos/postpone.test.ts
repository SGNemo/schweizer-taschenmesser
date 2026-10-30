import { describe, expect, it } from 'vitest';
import { postponePatch } from './postpone';

const DAY = '2026-10-19';

describe('postponePatch ("Später")', () => {
  it('plans a task without dates for tomorrow', () => {
    expect(postponePatch({}, DAY)).toEqual({ plannedFor: '2026-10-20' });
  });

  it('moves a plan for today (or earlier) to tomorrow', () => {
    expect(postponePatch({ plannedFor: DAY }, DAY)).toEqual({ plannedFor: '2026-10-20' });
    expect(postponePatch({ plannedFor: '2026-10-10' }, DAY)).toEqual({ plannedFor: '2026-10-20' });
  });

  it('also moves a date that is due today or passed, so the task does not come straight back', () => {
    expect(postponePatch({ dueDate: DAY }, DAY)).toEqual({
      plannedFor: '2026-10-20',
      dueDate: '2026-10-20',
    });
    expect(postponePatch({ dueDate: '2026-09-01', plannedFor: DAY }, DAY)).toEqual({
      plannedFor: '2026-10-20',
      dueDate: '2026-10-20',
    });
  });

  it('leaves a future due date alone', () => {
    expect(postponePatch({ dueDate: '2026-10-25' }, DAY)).toEqual({ plannedFor: '2026-10-20' });
  });

  it('never pulls a later plan forward', () => {
    expect(postponePatch({ plannedFor: '2026-10-30' }, DAY)).toEqual({});
  });
});
