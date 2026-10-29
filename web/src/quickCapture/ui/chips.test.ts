import { describe, expect, it } from 'vitest';
import { describeRecurrence, previewChips } from './chips';

describe('describeRecurrence', () => {
  it('names weekday sets, the interval and the end', () => {
    expect(describeRecurrence({ freq: 'weekly', interval: 1, byWeekday: [1, 2, 3, 4, 5] })).toBe(
      'an: Montag–Freitag',
    );
    expect(describeRecurrence({ freq: 'weekly', interval: 1, byWeekday: [1, 3] })).toBe(
      'an: Montag, Mittwoch',
    );
    expect(describeRecurrence({ freq: 'weekly', interval: 2, byWeekday: [3] })).toBe(
      'alle 2 Wochen, an: Mittwoch',
    );
    expect(
      describeRecurrence({ freq: 'weekly', interval: 1, byWeekday: [1], until: '2026-12-31' }),
    ).toMatch(/^jeden Montag, bis .*2026/);
  });
});

describe('previewChips', () => {
  it('shows the time range and the priority, only for what the type uses', () => {
    const labels = (type: 'event' | 'todo') =>
      previewChips(
        { title: 'X', date: '2026-11-12', time: '14:00', endTime: '16:00', priority: 3 },
        type,
        [],
        '2026-10-29',
      ).map((c) => c.label);
    expect(labels('event')).toContain('14:00–16:00 Uhr');
    expect(labels('event')).not.toContain('Priorität hoch');
    expect(labels('todo')).toContain('Priorität hoch');
  });
});
