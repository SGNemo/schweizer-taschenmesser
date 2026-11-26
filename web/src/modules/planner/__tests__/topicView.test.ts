import { describe, expect, it } from 'vitest';
import { capacityState } from '../components/capacity';
import { withDropped } from '../components/dragMove';
import { filterBoard, matcher, topicBand } from '../components/topicView';
import type { BoardData } from '../useBoard';

// Planner hub 2, package 11: the planner shrunk to one topic – pure, display only. Invented data.
const members = new Set([
  'todos:a',
  'subscriptions:netflix',
  'calendar:ev:1',
  'routines:r1',
  'documents:doc:x',
]);

describe('matcher (the prefix rule)', () => {
  const is = matcher(members);
  it('a member itself and its occurrence rows', () => {
    expect(is('todos:a')).toBe(true);
    expect(is('subscriptions:netflix:2026-12-01')).toBe(true);
    expect(is('routines:r1:2026-12-02')).toBe(true);
  });
  it('an id that holds colons itself', () => {
    expect(is('calendar:ev:1')).toBe(true);
    expect(is('calendar:ev:1:2026-12-03')).toBe(true);
    expect(is('documents:doc:x:k0')).toBe(true);
  });
  it('no other thing, not a thing whose id only starts the same', () => {
    expect(is('todos:ab')).toBe(false);
    expect(is('todos:b')).toBe(false);
    expect(is('calendar:ev')).toBe(false);
    expect(is('subscriptions')).toBe(false);
  });
});

const row = (itemKey: string) => ({ itemKey, unitId: `${itemKey}#0`, minutes: 30 });
const day = (date: string, keys: string[], blockers: { id: string; ref?: object }[] = []) => ({
  date,
  planned: keys.length * 30,
  free: 60,
  usable: 240,
  rows: keys.map(row),
  blockers,
  hints: [{ itemKey: 'todos:hint' }],
});

function data(): BoardData {
  return {
    board: {
      days: [
        day(
          '2026-12-01',
          ['todos:a', 'todos:b', 'subscriptions:netflix:2026-12-01'],
          [
            { id: 'cal:ev:1:2026-12-01', ref: { module: 'calendar', id: 'ev:1' } },
            { id: 'cal:ev:2:2026-12-01', ref: { module: 'calendar', id: 'ev:2' } },
            { id: 'break-1' },
          ],
        ),
      ],
      waiting: [row('todos:a'), row('todos:c')],
      late: [row('routines:r1:2026-11-28'), row('todos:d')],
      lateFolded: [row('todos:e')],
      open: [row('documents:doc:x:k0'), row('todos:f')],
      todayCount: 3,
    },
    view: [day('2026-12-08', ['todos:a', 'todos:g'])],
    today: '2026-11-30',
  } as unknown as BoardData;
}

describe('filterBoard', () => {
  const out = filterBoard(data(), members);
  it('the day keeps only member rows and member appointments; hints go; its sums stay the whole day’s', () => {
    const [d] = out.board.days;
    expect(d!.rows.map((r) => r.itemKey)).toEqual(['todos:a', 'subscriptions:netflix:2026-12-01']);
    expect(d!.blockers.map((b) => b.id)).toEqual(['cal:ev:1:2026-12-01']);
    expect(d!.hints).toEqual([]);
    expect(d!.free).toBe(60);
    expect(d!.planned).toBe(90);
  });
  it('„Noch ohne Tag“, „Frist vorbei“, „Noch offen“ and the days in view: members only', () => {
    expect(out.board.waiting.map((r) => r.itemKey)).toEqual(['todos:a']);
    expect(out.board.late.map((r) => r.itemKey)).toEqual(['routines:r1:2026-11-28']);
    expect(out.board.lateFolded).toEqual([]);
    expect(out.board.open.map((r) => r.itemKey)).toEqual(['documents:doc:x:k0']);
    expect(out.view!.map((d) => d.rows.map((r) => r.itemKey))).toEqual([['todos:a']]);
  });
  it('writes nothing into what it was given', () => {
    const before = data();
    filterBoard(before, members);
    expect(before).toEqual(data());
  });
});

describe('topicBand', () => {
  it('the bar carries the topic’s minutes (a fixed row charged against the whole day’s appointments); face, state and drop preview stay the whole day', () => {
    const fixed = {
      itemKey: 'todos:a',
      unitId: 'todos:a#0',
      minutes: 60,
      fixed: { from: '10:00', to: '11:00' },
    };
    const loose = { itemKey: 'todos:h', unitId: 'todos:h#0', minutes: 30 };
    const shown = [
      {
        date: '2026-12-01',
        planned: 285,
        off: false,
        free: 0,
        over: 45,
        usable: 240,
        rows: [fixed, loose],
        blockers: [],
      },
    ];
    // The whole day: a non-member appointment 10:30–11:00 covers half of the fixed row.
    const whole = [
      {
        date: '2026-12-01',
        rows: [],
        blockers: [{ id: 'cal:x', from: '10:30', to: '11:00', min: 30 }],
      },
    ];
    const [d] = topicBand(shown as never, whole as never);
    expect(d!.bar).toBe(30 + 30);
    // The tile's face, state and drop preview read the whole day: full and over.
    expect(d!.planned).toBe(285);
    expect(d!.free).toBe(0);
    expect(d!.over).toBe(45);
    expect(capacityState(d!)).toBe('over');
    expect(withDropped(d!, 60).over).toBe(105);
  });
});
