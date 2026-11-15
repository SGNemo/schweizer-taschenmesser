import { describe, expect, it } from 'vitest';
import type { BoardRow } from '../board';
import { capacityLabel, capacityShort, capacityState, capacityTile } from '../components/capacity';
import { firstDayWithRows, plannerHead } from '../head';

const row = (key: string, title = key): BoardRow =>
  ({ unitId: `${key}#0`, itemKey: key, title, minutes: 30, k: 0, of: 1 }) as BoardRow;

const day = (
  date: string,
  rows: BoardRow[] = [],
  cap: { free?: number; over?: number } = {},
  isToday = false,
) => ({ date, isToday, free: cap.free ?? 0, over: cap.over ?? 0, rows });

// Sunday 2026-11-15 is today; Monday follows.
const SUN = '2026-11-15';
const MON = '2026-11-16';
const WED = '2026-11-18';

describe('planner head: the next day that asks for something', () => {
  it('rule 1: today has things → today’s free time and „heute · n Dinge“ (no „heute“ in the figure)', () => {
    const days = [
      day(SUN, [row('a'), row('b'), row('c')], { free: 80 }, true),
      day(MON, [row('d')]),
    ];
    expect(plannerHead(days)).toEqual({ value: '1 h 20 frei', detail: 'heute · 3 Dinge' });
  });

  it('rule 1: over and full are said in words; a thing in two parts counts once', () => {
    const two = [row('a'), { ...row('a'), unitId: 'a#1', k: 1 }, row('b')];
    expect(plannerHead([day(SUN, two, { over: 40 }, true)])).toEqual({
      value: '40 Min mehr als planbar',
      detail: 'heute · 2 Dinge',
    });
    expect(plannerHead([day(SUN, two, {}, true)])!.value).toBe('Für heute ist genug geplant.');
  });

  it('rule 1: exactly one thing today → „Das reicht für heute.“ as the context (P13)', () => {
    expect(plannerHead([day(SUN, [row('a', 'Steuer')], { free: 30 }, true)])!.detail).toBe(
      'Heute: Steuer. Das reicht für heute.',
    );
  });

  it('rule 2: today empty → the next day’s figure, the context names it; the phone gets the first half', () => {
    const days = [day(SUN, [], { free: 0 }, true), day(MON, [row('a'), row('b')], { free: 37 })];
    expect(plannerHead(days)).toEqual({
      value: '37 Min frei',
      detail: 'morgen, Mo. 16. · heute ist frei',
    });
    expect(plannerHead(days, { short: true })!.detail).toBe('morgen, Mo. 16.');
  });

  it('rule 2: a later day is named by its date; a full next day says so for that day', () => {
    const later = [day(SUN, [], {}, true), day(MON), day('2026-11-17'), day(WED, [row('a')])];
    expect(plannerHead(later)).toEqual({
      value: 'Für Mittwoch ist genug geplant.',
      detail: 'Mi. 18. · heute ist frei',
    });
    const tomorrow = [day(SUN, [], {}, true), day(MON, [row('a')])];
    expect(plannerHead(tomorrow)!.value).toBe('Für morgen ist genug geplant.');
  });

  it('rule 4: no rows anywhere → no figure', () => {
    expect(plannerHead([day(SUN, [], { free: 120 }, true), day(MON)])).toBeUndefined();
    expect(plannerHead([])).toBeUndefined();
  });

  it('the page opens on the first day that holds things', () => {
    const days = [day(SUN, [], {}, true), day(MON, [row('a')]), day(WED, [row('b')])];
    expect(firstDayWithRows(days)?.date).toBe(MON);
    expect(firstDayWithRows([day(SUN)])).toBeUndefined();
  });
});

describe('capacity: more planned than fits is a state of its own', () => {
  const over = { off: false, usable: 60, planned: 100, free: 0, over: 40 };
  it('says the overrun in words on every surface; full stays full', () => {
    expect(capacityState(over)).toBe('over');
    expect(capacityLabel(over)).toBe('40 Min mehr als planbar');
    expect(capacityShort(over)).toBe('40 Min mehr');
    expect(capacityTile(over)).toBe('40 Min mehr');
    expect(capacityState({ ...over, planned: 60, over: 0 })).toBe('full');
    expect(capacityState({ ...over, off: true })).toBe('off');
  });
  it('the wide tile names the free time, the compact form the figure alone', () => {
    const free = { off: false, usable: 192, planned: 155, free: 37 };
    expect(capacityTile(free)).toBe('37 Min frei');
    expect(capacityShort(free)).toBe('37 Min');
  });
});
