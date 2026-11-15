/**
 * „Tagesende“ (use case „Wochenende retten“, package 6): when the planner head says „Bald ist Tagesende.“, when the
 * same sentence carries „Rest verteilen“, and that it replaces the 17:00 link in that half hour. Plus how the
 * setting reads what the person typed.
 */
import { describe, expect, it } from 'vitest';
import type { BoardDay } from '../board';
import { dayEndNear, eveningLine } from '../rest';
import { DEFAULT_PLANNER_SETTINGS, dayEndOf, plannerSettingsSchema } from '../settings';

const SAT = '2026-11-14';
const at = (hhmm: string, date = SAT) => new Date(`${date}T${hhmm}:00`).getTime();
type Day = Pick<BoardDay, 'date' | 'rows'>;
const day = (rows: { pinned?: string }[]): Day => ({
  date: SAT,
  rows: rows.map((r) => ({
    item: r.pinned ? { pinned: r.pinned } : undefined,
  })) as BoardDay['rows'],
});
const open = day([{}]);
const empty = day([]);

describe('dayEndNear', () => {
  it('is on from 30 minutes before the day end up to it', () => {
    expect(dayEndNear(true, at('22:29'), '23:00')).toBe(false);
    expect(dayEndNear(true, at('22:30'), '23:00')).toBe(true);
    expect(dayEndNear(true, at('22:59'), '23:00')).toBe(true);
    expect(dayEndNear(true, at('23:00'), '23:00')).toBe(false);
    expect(dayEndNear(true, at('23:40'), '23:00')).toBe(false);
  });

  it('reads 00:00 as midnight', () => {
    expect(dayEndNear(true, at('23:29'), '00:00')).toBe(false);
    expect(dayEndNear(true, at('23:30'), '00:00')).toBe(true);
    expect(dayEndNear(true, at('23:59'), '00:00')).toBe(true);
    expect(dayEndNear(true, at('00:00'), '00:00')).toBe(false);
    expect(dayEndNear(true, at('00:10'), '00:15')).toBe(true);
    expect(dayEndNear(true, at('23:50'), '00:15')).toBe(true);
  });

  it('says nothing without a day end or with the switch off', () => {
    expect(dayEndNear(true, at('22:45'), undefined)).toBe(false);
    expect(dayEndNear(false, at('22:45'), '23:00')).toBe(false);
  });
});

describe('eveningLine', () => {
  it('near the day end: the sentence, with the link while today holds something open', () => {
    expect(eveningLine(true, at('22:45'), '23:00', open)).toEqual({ kind: 'dayEnd', rest: true });
    expect(eveningLine(true, at('22:45'), '23:00', empty)).toEqual({ kind: 'dayEnd', rest: false });
    // A thing nailed to today stays, so it alone is nothing to move.
    expect(eveningLine(true, at('22:45'), '23:00', day([{ pinned: SAT }]))).toEqual({
      kind: 'dayEnd',
      rest: false,
    });
    expect(eveningLine(true, at('22:45'), '23:00', undefined)).toEqual({
      kind: 'dayEnd',
      rest: false,
    });
  });

  it('else the 17:00 link as before, never before 17:00', () => {
    expect(eveningLine(true, at('21:00'), '23:00', open)).toEqual({ kind: 'rest' });
    expect(eveningLine(true, at('23:10'), '23:00', open)).toEqual({ kind: 'rest' });
    expect(eveningLine(true, at('21:00'), undefined, open)).toEqual({ kind: 'rest' });
    expect(eveningLine(true, at('16:59'), undefined, open)).toBeUndefined();
    expect(eveningLine(true, at('21:00'), undefined, empty)).toBeUndefined();
  });

  it('an early day end shows before 17:00 too', () => {
    expect(eveningLine(true, at('15:40'), '16:00', open)).toEqual({ kind: 'dayEnd', rest: true });
  });

  it('nothing at all with the switch off', () => {
    expect(eveningLine(false, at('22:45'), '23:00', open)).toBeUndefined();
    expect(eveningLine(false, at('21:00'), undefined, open)).toBeUndefined();
  });
});

describe('dayEnd setting', () => {
  const read = (dayEnd: unknown) =>
    plannerSettingsSchema.parse({ ...DEFAULT_PLANNER_SETTINGS, dayEnd }).dayEnd;

  it('is empty by default and additive (older stored settings without it read as none)', () => {
    expect(DEFAULT_PLANNER_SETTINGS.dayEnd).toBe('');
    expect(dayEndOf(DEFAULT_PLANNER_SETTINGS)).toBeUndefined();
    const { dayEnd: _drop, ...older } = DEFAULT_PLANNER_SETTINGS;
    expect(plannerSettingsSchema.parse(older).dayEnd).toBe('');
  });

  it('reads typed times back as HH:mm and keeps anything else as no day end', () => {
    expect(read('23')).toBe('23:00');
    expect(read('0')).toBe('00:00');
    expect(read('22.30')).toBe('22:30');
    expect(read('spät')).toBe('spät');
    expect(dayEndOf({ dayEnd: 'spät' })).toBeUndefined();
    expect(dayEndOf({ dayEnd: '00:00' })).toBe('00:00');
    expect(read(5)).toBe('');
  });
});
