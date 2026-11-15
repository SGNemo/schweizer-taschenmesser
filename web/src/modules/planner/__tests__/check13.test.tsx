// @vitest-environment jsdom
/**
 * Two findings of the check of packages 1–3 (docs/design/usecases/wochenende/CHECK-1-3.md), built in package 6:
 * C5 – a preview move past the thing's deadline names it („nach der Frist So“) instead of „der Tag hat weniger
 * Zeit“; C6 – step 2 of „Tage einteilen“ says it in one calm line when the day's appointments fill the chosen time.
 */
import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { PlanPreview, pastDue } from '../components/PlanPreview';
import { eventsFill } from '../daySetup';
import type { WaitingRow } from '../board';
import { duesOf } from '../rest';

const SAT = '2026-11-14';
const SUN = '2026-11-15';
const MON = '2026-11-16';

describe('C5: a move past the deadline', () => {
  it('finds the deadline a move lands after, by the unit’s item key', () => {
    const dues = { 'todos:a': SUN };
    expect(pastDue('todos:a#0', SAT, MON, dues)).toBe(SUN);
    expect(pastDue('todos:a#1', SAT, SUN, dues)).toBeUndefined(); // on the deadline itself is still in time
    expect(pastDue('todos:b#0', SAT, MON, dues)).toBeUndefined();
    expect(pastDue('todos:a#0', SAT, MON, undefined)).toBeUndefined();
    // Already past it before the move: the move crosses no deadline, its own cause stays.
    expect(pastDue('todos:a#0', MON, '2026-11-17', dues)).toBeUndefined();
  });

  it('takes only hard deadlines, by the board’s rule – a ToDo’s or routine’s soft date is none', () => {
    const waiting = [
      { itemKey: 'todos:w', entry: { due: { date: SUN, hard: true } } },
      { itemKey: 'todos:s', entry: { due: { date: SAT, hard: false } } },
      {
        itemKey: 'todos:i',
        item: { due: { date: SUN, hard: true } },
        entry: { due: { date: SAT, hard: false } },
      },
    ] as unknown as WaitingRow[];
    expect(
      duesOf({
        days: [{ rows: [{ itemKey: 'todos:a', hardDue: SUN }, { itemKey: 'routines:r' }] }],
        waiting,
      }),
    ).toEqual({ 'todos:a': SUN, 'todos:w': SUN, 'todos:i': SUN });
  });

  it('the preview row says „nach der Frist …“, other rows keep their cause', () => {
    render(
      <PlanPreview
        data={{
          lines: [],
          dues: { 'todos:a': SUN },
          diff: {
            added: [],
            removed: [],
            unchanged: 0,
            moved: [
              { id: 'todos:a#0', from: SAT, to: MON, reason: 'capacity' },
              { id: 'todos:b#0', from: SAT, to: MON, reason: 'capacity' },
            ],
          },
        }}
        nameOf={(id) => id.slice(6, 7)}
        onApply={() => undefined}
        onDiscard={() => undefined}
      />,
    );
    expect(screen.getByText(/nach der Frist So/)).toBeTruthy();
    expect(screen.getAllByText(/der Tag hat weniger Zeit/)).toHaveLength(1);
  });
});

describe('C6: appointments fill the chosen time', () => {
  const day = (blockers: { min: number; calendar: boolean }[]) => ({ blockers });

  it('only when the day’s appointments take at least the chosen minutes', () => {
    const office = day([{ min: 480, calendar: true }]);
    expect(eventsFill(office, 240)).toBe(true);
    expect(eventsFill(office, 480)).toBe(true);
    expect(eventsFill(office, 720)).toBe(false);
    // „keine Zeit“ needs no line; own blockers (a break) are the person's own choice, not appointments.
    expect(eventsFill(office, 0)).toBe(false);
    expect(eventsFill(day([{ min: 480, calendar: false }]), 240)).toBe(false);
    expect(eventsFill(day([]), 240)).toBe(false);
  });
});
