import { describe, expect, it } from 'vitest';
import type { DueNotification } from '@/core/modules/types';
import { applyLimit, applyPolicy, applyQuiet, inQuiet, quietEnd } from './policy';

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
