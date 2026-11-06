// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { setNow } from '@/core/time/now';
import { WidgetSizeContext } from '@/ui/widgets/size';
import { assignmentRepo, dayRepo } from '../repo';
import WeekWidget, { weekEntries, weekSummary } from '../widgets/WeekWidget';
import type { BoardDay } from '../board';

const NOW = new Date(2026, 10, 9, 10, 0).getTime(); // Monday 2026-11-09

const view = (size: 's' | 'm' | 'l' = 'm') =>
  render(
    <MemoryRouter>
      <WidgetSizeContext.Provider value={size}>
        <WeekWidget />
      </WidgetSizeContext.Provider>
    </MemoryRouter>,
  );

const day = (over: Partial<BoardDay>): BoardDay => ({
  date: '2026-11-10',
  isToday: false,
  defaultMin: 240,
  availableMin: 240,
  raw: 240,
  usable: 192,
  planned: 0,
  free: 192,
  over: 0,
  off: false,
  blockers: [],
  rows: [],
  ...over,
});

beforeEach(async () => {
  setNow(() => NOW);
  for (const t of [
    'planner_day',
    'planner_item',
    'planner_assignment',
    'todos_task',
    '_settings',
    '_meta',
    '_modules',
  ])
    await db.table(t).clear();
});
afterEach(() => setNow());

describe('week widget', () => {
  it('shows an empty state with an action when nothing is planned', async () => {
    view();
    expect(await screen.findByRole('link', { name: 'Etwas eintragen' })).toHaveAttribute(
      'href',
      '/planner?new=1',
    );
  });

  it('one row per day with the free minutes, the summary labelled with the last shown day; never red', async () => {
    await dayRepo.upsert('2026-11-10', { date: '2026-11-10', availableMin: 0, blockers: [] });
    await assignmentRepo.upsert('todos:a#0', {
      itemKey: 'todos:a',
      k: 0,
      of: 1,
      date: '2026-11-09',
      minutes: 145,
      order: 0,
      reason: 'new',
    });
    view('s');
    expect(await screen.findByText('Heute · 47 Min frei')).toBeInTheDocument();
    expect(screen.getByText('2 h 25 geplant')).toBeInTheDocument();
    expect(screen.getByText('Di · frei')).toBeInTheDocument();
    expect(screen.getByText('Bis Di: 2 h 25 geplant · 47 Min frei')).toBeInTheDocument();
    expect(document.querySelector('[class*="over"]')).toBeNull();
  });

  it('a day with no usable time and nothing planned says so; a day off still wins, also today', () => {
    const [none, off, todayOff] = weekEntries([
      day({ isToday: true, usable: 0, raw: 0, free: 0, planned: 0 }),
      day({ date: '2026-11-11', off: true, usable: 0, raw: 0, free: 0, planned: 0 }),
      day({ isToday: true, off: true, usable: 0, raw: 0, free: 0, planned: 0 }),
    ]);
    expect(none!.title).toBe('Heute · keine freie Zeit');
    expect(off!.title).toBe('Mi · frei');
    expect(todayOff!.title).toBe('Heute · frei');
  });

  it('entries: today, a full day, a day off, an overrun in the detail; the summary sums the shown rows', () => {
    const days = [
      day({ date: '2026-11-09', isToday: true, planned: 145, free: 47 }),
      day({ date: '2026-11-10', planned: 192, free: 0 }),
      day({ date: '2026-11-11', planned: 212, free: 0, over: 20 }),
      day({ date: '2026-11-12', off: true, availableMin: 0, raw: 0, usable: 0, free: 0 }),
    ];
    const entries = weekEntries(days);
    expect(entries.map((e) => e.title)).toEqual([
      'Heute · 47 Min frei',
      'Di · voll',
      'Mi · voll',
      'Do · frei',
    ]);
    expect(entries.map((e) => e.detail)).toEqual([
      '2 h 25 geplant',
      '3 h 12 geplant',
      '20 Min mehr als planbar',
      'nichts geplant',
    ]);
    expect(entries.every((e) => e.overText === undefined)).toBe(true);
    expect(weekSummary(days)).toBe('Bis Do: 9 h 9 geplant · 47 Min frei');
  });
});
