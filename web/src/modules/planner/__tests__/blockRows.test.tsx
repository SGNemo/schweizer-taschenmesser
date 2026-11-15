// @vitest-environment jsdom
/**
 * Planner hub S4 (CONCEPT-DESIGN §4): the day's blocks lie recessed above „Zuerst“ in time order – an appointment,
 * a fixed training (tick, its time, „fest“, a ⋯ without moving steps) and a habit's kept time (clock, the typed
 * name, its minutes; no tick, no ⋯, never „offen“).
 */
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { describe, expect, it } from 'vitest';
import type { PlannableEntry } from '@/core/modules/contributions';
import type { BoardDay, BoardRow } from '../board';
import { DayPage } from '../components/DayPage';
import { ThingRow } from '../components/ThingRow';

const training: PlannableEntry = {
  moduleId: 'fitness',
  id: 's1',
  kind: 'training',
  title: 'Training: Oberkörper',
  to: '/fitness?open=s1',
  durationMin: 60,
  earliest: '2026-11-16',
  fixed: { from: '18:00' },
};
const row = (over: Partial<BoardRow>): BoardRow => ({
  unitId: 'todos:a#0',
  itemKey: 'todos:a',
  title: 'Steuer',
  minutes: 30,
  k: 0,
  of: 1,
  reason: 'new',
  approx: false,
  pinned: false,
  ...over,
});
const gym = row({
  unitId: 'fitness:s1#0',
  itemKey: 'fitness:s1',
  title: training.title,
  minutes: 60,
  reason: 'pinned',
  entry: training,
  fixed: { from: '18:00', to: '19:00' },
});
const DAY: BoardDay = {
  date: '2026-11-16',
  isToday: false,
  availableMin: 240,
  raw: 150,
  usable: 120,
  planned: 90,
  free: 30,
  over: 0,
  off: false,
  defaultMin: 240,
  blockers: [
    {
      id: 'habits:g1:2026-11-16',
      label: 'Spazieren gehen',
      min: 30,
      calendar: false,
      module: 'habits',
    },
    {
      id: 'cal:calendar:e1',
      label: 'Teamrunde',
      min: 60,
      from: '09:30',
      to: '10:30',
      calendar: true,
    },
  ],
  rows: [row({}), gym],
};

const draw = (day: BoardDay = DAY) =>
  render(
    <MemoryRouter>
      <DayPage
        day={day}
        tomorrow
        renderRow={(r) => (
          <ThingRow
            key={r.unitId}
            row={r}
            reason=""
            whyOpen={false}
            dueClock={0}
            menu={[{ id: 'open', label: 'Öffnen', onSelect: () => undefined }]}
            onDone={async () => true}
          />
        )}
        onEditDay={() => undefined}
        thenOpen
        onThenToggle={() => undefined}
        empty={<p>leer</p>}
      />
    </MemoryRouter>,
  );

describe('the blocks of a day (S4)', () => {
  it('lie above „Zuerst“ in time order: appointment, training, then the habit without a time', () => {
    draw();
    const blocks = screen.getByRole('list', { name: 'Blocker' });
    const items = within(blocks).getAllByRole('listitem');
    expect(items.map((li) => li.textContent)).toEqual([
      expect.stringContaining('Teamrunde'),
      expect.stringContaining('Training: Oberkörper'),
      expect.stringContaining('Spazieren gehen'),
    ]);
    // The training is no thing of „Zuerst“.
    const first = screen.getByRole('list', { name: 'Zuerst' });
    expect(within(first).queryByText('Training: Oberkörper')).toBeNull();
    expect(within(first).getByText('Steuer')).toBeInTheDocument();
  });

  it('the training keeps its tick and says its time and „fest“', () => {
    draw();
    const li = screen.getByText('Training: Oberkörper').closest('li')!;
    expect(
      within(li).getByRole('checkbox', { name: 'Erledigt: Training: Oberkörper' }),
    ).toBeInTheDocument();
    expect(li.textContent).toContain('18:00–19:00');
    expect(li.textContent).toContain('fest');
  });

  it('the habit block has no tick and no ⋯, says its source and minutes, never „offen“', () => {
    draw();
    const li = screen.getByText('Spazieren gehen').closest('li')!;
    expect(within(li).queryByRole('checkbox')).toBeNull();
    expect(within(li).queryByRole('button')).toBeNull();
    expect(li.textContent).toContain('Gewohnheit');
    expect(li.textContent).toContain('30 Min');
    expect(li.textContent).not.toMatch(/offen|verpasst/i);
  });

  it('a day with only the training shows no empty line under it', () => {
    draw({ ...DAY, blockers: [], rows: [gym] });
    expect(screen.queryByText('leer')).toBeNull();
    expect(screen.queryByRole('heading', { name: 'Zuerst' })).toBeNull();
  });
});
