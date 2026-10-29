import { describe, expect, it } from 'vitest';
import { readQuickAdd } from '../quickAdd';

const NOW = new Date(2026, 9, 29, 10, 0);

describe('readQuickAdd', () => {
  it('takes the deadline out of the line (QA J-B2)', () => {
    expect(readQuickAdd('Hausarbeit Statistik abgeben morgen 23:59 Uhr', NOW)).toMatchObject({
      title: 'Hausarbeit Statistik abgeben',
      dueDate: '2026-10-30',
      time: '23:59',
      note: 'Uhrzeit: 23:59',
    });
  });

  it('reads priority and effort', () => {
    expect(readQuickAdd('Angebot schicken bis Freitag !hoch 30 min', NOW)).toMatchObject({
      title: 'Angebot schicken',
      dueDate: '2026-10-30',
      priority: 3,
      estimateMin: 30,
    });
  });

  it('leaves the text alone when nothing was recognised or it repeats', () => {
    expect(readQuickAdd('  Milch kaufen ', NOW)).toEqual({ title: 'Milch kaufen' });
    expect(readQuickAdd('jeden Montag Sport', NOW)).toEqual({ title: 'jeden Montag Sport' });
    expect(readQuickAdd('Morgenroutine planen', NOW)).toEqual({ title: 'Morgenroutine planen' });
  });
});
