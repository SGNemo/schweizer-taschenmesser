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

describe('A05 (round 5): words of the title stay', () => {
  const at = new Date(2026, 10, 8, 10, 0);
  it.each([
    ['Rechnung zahlen heute', 'Rechnung zahlen'],
    ['Aufgabe 3 abschreiben morgen', 'Aufgabe 3 abschreiben'],
    ['Geburtstag von Ana planen heute', 'Geburtstag von Ana planen'],
    ['Ausgaben notieren heute', 'Ausgaben notieren'],
  ])('"%s" keeps "%s" and still gets its date', (typed, title) => {
    const q = readQuickAdd(typed, at);
    expect(q.title).toBe(title);
    expect(q.dueDate).toMatch(/^2026-11-0[89]$/);
  });
});
