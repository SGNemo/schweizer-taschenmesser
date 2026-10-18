import { describe, expect, it } from 'vitest';
import type { DueNotification } from '@/core/modules/types';
import {
  applyLimit,
  applyPolicy,
  applyQuiet,
  baseKey,
  collapseRepeats,
  inQuiet,
  isRepeatKey,
  quietEnd,
  repeatSeries,
} from './policy';

const at = (h: number, m = 0, day = 2) => new Date(2026, 9, day, h, m).getTime();
const n = (key: string, when: number, soft = false): DueNotification => ({
  key,
  at: when,
  title: key,
  ...(soft ? { soft } : {}),
});
const summary = (count: number, titles: string[]) => ({
  title: `Weitere · ${count}`,
  body: titles.join(', '),
});
const quiet = { from: '22:00', to: '07:00' };

describe('quiet hours', () => {
  it('knows when it is quiet, also across midnight', () => {
    expect(inQuiet(at(23), quiet)).toBe(true);
    expect(inQuiet(at(3), quiet)).toBe(true);
    expect(inQuiet(at(7), quiet)).toBe(false);
    expect(inQuiet(at(12), quiet)).toBe(false);
    expect(inQuiet(at(13), { from: '12:00', to: '14:00' })).toBe(true);
    expect(inQuiet(at(13), { from: '08:00', to: '08:00' })).toBe(false);
  });

  it('finds the end of the quiet hours', () => {
    expect(quietEnd(at(23), quiet)).toBe(at(7, 0, 3));
    expect(quietEnd(at(3), quiet)).toBe(at(7, 0, 2));
  });

  it('moves soft notifications to the end, keeps explicit ones where they are', () => {
    const out = applyQuiet(
      [n('soft', at(23), true), n('hard', at(23)), n('day', at(12), true)],
      quiet,
    );
    expect(out.find((x) => x.key === 'soft')?.at).toBe(at(7, 0, 3));
    expect(out.find((x) => x.key === 'hard')?.at).toBe(at(23));
    expect(out.find((x) => x.key === 'day')?.at).toBe(at(12));
  });

  it('does nothing without quiet hours', () => {
    expect(applyQuiet([n('a', at(23), true)], undefined)[0]!.at).toBe(at(23));
  });
});

describe('limit per hour', () => {
  const nine = [1, 2, 3, 4, 5].map((i) => n(`e${i}`, at(9, i)));

  it('keeps max-1 and folds the rest into one summary', () => {
    const out = applyLimit(nine, 3, summary);
    expect(out.map((x) => x.key)).toEqual([
      'e1',
      'e2',
      'summary:' + Math.floor(at(9, 3) / 3_600_000) + ':3',
    ]);
    expect(out[2]!.title).toBe('Weitere · 3');
    expect(out[2]!.body).toBe('e3, e4, e5');
    expect(out).toHaveLength(3);
  });

  it('leaves hours under the limit alone and counts hours separately', () => {
    const items = [
      n('a', at(9, 1)),
      n('b', at(9, 2)),
      n('c', at(10, 1)),
      n('d', at(10, 2)),
      n('e', at(10, 3)),
    ];
    expect(applyLimit(items, 3, summary).map((x) => x.key)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });

  it('0 means unlimited', () => {
    expect(applyLimit(nine, 0, summary)).toHaveLength(5);
  });

  it('a limit of 1 gives a single summary for a crowded hour', () => {
    const out = applyLimit(nine, 1, summary);
    expect(out).toHaveLength(2);
  });
});

describe('applyPolicy', () => {
  it('de-duplicates by key, then applies quiet hours and the limit', () => {
    const items = [
      n('a', at(23), true),
      n('a', at(23), true),
      n('b', at(9, 1)),
      n('c', at(9, 2)),
      n('d', at(9, 3)),
      n('e', at(9, 4)),
    ];
    const out = applyPolicy(items, { quiet, maxPerHour: 3 }, summary);
    expect(out.find((x) => x.key === 'a')?.at).toBe(at(7, 0, 3));
    expect(out.filter((x) => x.key === 'a')).toHaveLength(1);
    expect(out.some((x) => x.key.startsWith('summary:'))).toBe(true);
  });
});

describe('repeats until answered ("Ruhige Erinnerungen")', () => {
  const base = { key: 'event:a:2026-10-02T10:00', at: at(10), url: '/calendar', title: 'Paket' };
  const text = (k: number, last: boolean) => ({
    title: `Noch offen ${k}`,
    body: last ? 'letzte' : undefined,
  });
  const series = (
    over: { answered?: boolean; every?: number; max?: number; from?: number; to?: number } = {},
  ) =>
    repeatSeries(
      base,
      { everyMin: over.every ?? 30, max: over.max ?? 6 },
      over.answered ?? false,
      { from: over.from ?? at(9), to: over.to ?? at(23) },
      text,
    );

  it('10:00, no reaction → 10:30, 11:00, … up to the limit; the last one says so', () => {
    const out = series();
    expect(out.map((x) => x.at)).toEqual([
      at(10, 30),
      at(11),
      at(11, 30),
      at(12),
      at(12, 30),
      at(13),
    ]);
    expect(out.map((x) => x.key)).toEqual(
      ['1', '2', '3', '4', '5', '6'].map((k) => `${base.key}:r${k}`),
    );
    expect(out.every((x) => x.soft && x.url === '/calendar')).toBe(true);
    expect(out[5]!.body).toBe('letzte');
    expect(out[0]!.body).toBeUndefined();
    expect(out[0]!.title).toBe('Noch offen 1');
    expect(out[0]!.baseTitle).toBe('Paket');
  });

  it('a different gap and limit', () => {
    expect(series({ every: 10, max: 3 }).map((x) => x.at)).toEqual([
      at(10, 10),
      at(10, 20),
      at(10, 30),
    ]);
    expect(series({ every: 60, max: 2 }).map((x) => x.at)).toEqual([at(11), at(12)]);
    expect(series({ max: 0 })).toEqual([]);
    expect(series({ every: 0 })).toEqual([]);
  });

  it('only the repeats inside (from, to] are returned; a boundary at `from` is excluded, at `to` included', () => {
    expect(series({ from: at(10, 30), to: at(11, 30) }).map((x) => x.at)).toEqual([
      at(11),
      at(11, 30),
    ]);
  });

  it('answered → no repeats at all ("Erledigt"/"Später" end the series at once)', () => {
    expect(series({ answered: true })).toEqual([]);
  });

  it('answer in the middle: Abhaken 11:10 leaves only what already fell due before', () => {
    // The caller recomputes with answered=true at 11:10: the future repeats are gone, the past ones are not replayed.
    const before = series({ to: at(11, 10) }).map((x) => x.at);
    expect(before).toEqual([at(10, 30), at(11)]);
    expect(series({ answered: true, from: at(11, 10) })).toEqual([]);
  });

  it('baseKey and isRepeatKey know stages, the old follow-up and repeats', () => {
    for (const s of [':s60', ':f', ':r3']) expect(baseKey(`event:a:d${s}`)).toBe('event:a:d');
    expect(baseKey('event:a:d')).toBe('event:a:d');
    expect(isRepeatKey('x:r1')).toBe(true);
    expect(isRepeatKey('x:s60')).toBe(false);
    expect(isRepeatKey('snooze:r1@5')).toBe(false);
  });

  it('quiet hours: a repeat in the night is dropped, not moved; the series still ends at the limit', () => {
    const late = { key: 'k', at: at(21, 30), title: 'K' };
    const out = repeatSeries(
      late,
      { everyMin: 30, max: 6 },
      false,
      { from: at(21), to: at(23, 59) },
      text,
    );
    expect(out.map((x) => x.at)).toEqual([at(22), at(22, 30), at(23), at(23, 30)]);
    const policy = applyPolicy(out, { maxPerHour: 0, quiet }, summary);
    expect(policy).toEqual([]);
    // The morning does not collect the night's repeats either.
    expect(applyQuiet([n('k:r1', at(23), true), n('k:r2', at(3, 0, 3), true)], quiet)).toEqual([]);
  });

  it('quiet-hours boundary: 21:59 passes, 22:00 is dropped, 07:00 passes again', () => {
    const items = [
      n('a:r1', at(21, 59), true),
      n('a:r2', at(22), true),
      n('a:r3', at(6, 59, 3), true),
      n('a:r4', at(7, 0, 3), true),
    ];
    expect(applyQuiet(items, quiet).map((x) => x.key)).toEqual(['a:r1', 'a:r4']);
  });

  it('other soft extras are still moved to the end of the quiet hours', () => {
    expect(applyQuiet([n('a:s60', at(23), true)], quiet)[0]!.at).toBe(at(7, 0, 3));
  });

  it('"Stumm": repeats inside the pause are dropped, the reminder itself arrives quietly', () => {
    const mute = { from: at(10), until: at(12) };
    const out = applyPolicy(
      [n('a', at(10, 5)), n('a:r1', at(10, 35), true), n('a:r2', at(12, 5), true)],
      { maxPerHour: 0, mute },
      summary,
    );
    expect(out.map((x) => [x.key, x.quiet ?? false])).toEqual([
      ['a', true],
      ['a:r2', false],
    ]);
  });

  it('max per hour still holds and a repeat never pushes a first reminder into the summary', () => {
    const items = [n('a:r1', at(10, 5), true), n('b', at(10, 10)), n('c', at(10, 20))];
    const out = applyPolicy(items, { maxPerHour: 2, quiet: undefined }, summary);
    expect(out.map((x) => x.key)).toContain('b');
    expect(out.map((x) => x.key)).not.toContain('a:r1');
    expect(out.some((x) => x.key.startsWith('summary:'))).toBe(true);
  });

  it('several reminders at once keep separate series that end independently', () => {
    const a = repeatSeries(
      { key: 'a', at: at(10), title: 'a' },
      { everyMin: 30, max: 3 },
      false,
      { from: at(9), to: at(23) },
      text,
    );
    const b = repeatSeries(
      { key: 'b', at: at(10, 15), title: 'b' },
      { everyMin: 30, max: 3 },
      true,
      { from: at(9), to: at(23) },
      text,
    );
    const c = repeatSeries(
      { key: 'c', at: at(10, 15), title: 'c' },
      { everyMin: 30, max: 3 },
      false,
      { from: at(9), to: at(23) },
      text,
    );
    const out = applyPolicy([...a, ...b, ...c], { maxPerHour: 0 }, summary);
    expect(out.map((x) => x.key)).toEqual(['a:r1', 'c:r1', 'a:r2', 'c:r2', 'a:r3', 'c:r3']);
    expect(new Set(out.map((x) => x.key)).size).toBe(out.length);
  });

  it('catch-up after a long pause shows only the latest of a reminder and its repeats', () => {
    const items = [
      n('a', at(10)),
      n('a:r1', at(10, 30), true),
      n('a:r2', at(11), true),
      n('a:s60', at(9), true),
      n('b', at(10, 5)),
    ];
    expect(collapseRepeats(items).map((x) => x.key)).toEqual(['a:r2', 'a:s60', 'b']);
    expect(collapseRepeats([n('c', at(9))]).map((x) => x.key)).toEqual(['c']);
  });
});

describe('applyQuietAll (game mode without a tone)', () => {
  it('marks every notification quiet and moves nothing', () => {
    const items = [n('a', at(10)), n('b', at(11), true)];
    const out = applyPolicy(items, { maxPerHour: 0, quietAll: true }, summary);
    expect(out.map((x) => [x.key, x.at, x.quiet])).toEqual([
      ['a', at(10), true],
      ['b', at(11), true],
    ]);
  });

  it('changes nothing when off', () => {
    const out = applyPolicy([n('a', at(10))], { maxPerHour: 0 }, summary);
    expect(out[0]?.quiet).toBeUndefined();
  });
});
