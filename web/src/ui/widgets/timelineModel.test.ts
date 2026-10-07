import { describe, expect, it } from 'vitest';
import { buildTimeline, type TimelineItem } from './timelineModel';

const item = (key: string, time?: string, endTime?: string): TimelineItem => ({
  key,
  title: key,
  time,
  endTime,
  allDay: !time,
});

describe('buildTimeline', () => {
  const items = [
    item('b', '13:00', '14:00'),
    item('a', '09:00', '10:00'),
    item('ganz'),
    item('c', '18:00'),
  ];

  it('puts all-day first, sorts by start and marks now and next', () => {
    const rows = buildTimeline(items, '11:00');
    expect(rows.map((r) => (r.type === 'now' ? 'NOW' : r.item.key))).toEqual([
      'ganz',
      'a',
      'NOW',
      'b',
      'c',
    ]);
    const next = rows.filter((r) => r.type === 'item' && r.next);
    expect(next).toHaveLength(1);
    expect(next[0]).toMatchObject({ item: { key: 'b' } });
    expect(rows.find((r) => r.type === 'item' && r.item.key === 'a')).toMatchObject({ past: true });
  });

  it('keeps a running item as current, not next', () => {
    const rows = buildTimeline(items, '13:30');
    const b = rows.find((r) => r.type === 'item' && r.item.key === 'b');
    expect(b).toMatchObject({ next: false, past: false });
    expect(rows.find((r) => r.type === 'item' && r.next)).toMatchObject({ item: { key: 'c' } });
  });

  it('puts the marker last when everything is over, and omits it without a clock', () => {
    const rows = buildTimeline(items, '23:00');
    expect(rows.at(-1)).toEqual({ type: 'now', time: '23:00' });
    expect(buildTimeline(items, null).some((r) => r.type === 'now')).toBe(false);
  });
});
