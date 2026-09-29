import { describe, expect, it } from 'vitest';
import { toEpoch } from '@/core/time/dates';
import { nextOccurrenceAt, occurrencesInRange, reminderStatus, sortReminders } from './logic';
import { reminderSchema } from './schema';

const make = (over: Record<string, unknown>) =>
  reminderSchema.parse({ title: 't', startDate: '2026-01-01', ...over });

const at = (date: string, time: string) => toEpoch(date, time);

describe('reminder logic', () => {
  it('one-off reminder: next occurrence until it has passed', () => {
    const r = make({ startDate: '2026-05-10', time: '08:30' });
    expect(nextOccurrenceAt(r, at('2026-05-01', '12:00'))).toMatchObject({
      date: '2026-05-10',
      time: '08:30',
    });
    expect(nextOccurrenceAt(r, at('2026-05-10', '08:30'))?.date).toBe('2026-05-10'); // exactly now still counts
    expect(nextOccurrenceAt(r, at('2026-05-10', '08:31'))).toBeUndefined();
    expect(reminderStatus(r, at('2026-06-01', '00:00'))).toBe('ended');
  });

  it('"every 1st" (rent): skips to next month once today\'s time passed', () => {
    const r = make({
      startDate: '2026-01-01',
      time: '09:00',
      recurrence: { freq: 'monthly', byMonthDay: 1 },
    });
    expect(nextOccurrenceAt(r, at('2026-09-29', '10:00'))).toMatchObject({ date: '2026-10-01' });
    expect(nextOccurrenceAt(r, at('2026-10-01', '08:00'))).toMatchObject({ date: '2026-10-01' });
    expect(nextOccurrenceAt(r, at('2026-10-01', '09:01'))).toMatchObject({ date: '2026-11-01' });
  });

  it('ends when the recurrence has an until date in the past', () => {
    const r = make({ recurrence: { freq: 'daily', until: '2026-01-03' } });
    expect(nextOccurrenceAt(r, at('2026-01-03', '10:00'))).toBeUndefined();
    expect(nextOccurrenceAt(r, at('2026-01-02', '10:00'))?.date).toBe('2026-01-03');
  });

  it('lists occurrences in a range with epoch times', () => {
    const r = make({ startDate: '2026-01-05', time: '07:15', recurrence: { freq: 'weekly' } });
    const list = occurrencesInRange(r, '2026-01-01', '2026-01-20');
    expect(list.map((o) => o.date)).toEqual(['2026-01-05', '2026-01-12', '2026-01-19']);
    expect(list[0]!.at).toBe(at('2026-01-05', '07:15'));
  });

  it('paused reminders never count as upcoming', () => {
    expect(
      reminderStatus(
        make({ active: false, recurrence: { freq: 'daily' } }),
        at('2026-01-01', '00:00'),
      ),
    ).toBe('paused');
  });

  it('sorts upcoming by time, then paused, then ended', () => {
    const now = at('2026-05-01', '12:00');
    const soon = { ...make({ title: 'soon', startDate: '2026-05-02' }), createdAt: 1 };
    const later = { ...make({ title: 'later', startDate: '2026-06-01' }), createdAt: 2 };
    const paused = {
      ...make({ title: 'paused', startDate: '2026-05-02', active: false }),
      createdAt: 3,
    };
    const ended = { ...make({ title: 'ended', startDate: '2026-01-01' }), createdAt: 4 };
    expect(sortReminders([ended, paused, later, soon], now).map((r) => r.title)).toEqual([
      'soon',
      'later',
      'paused',
      'ended',
    ]);
  });
});
