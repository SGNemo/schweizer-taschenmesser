// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { setNow } from '@/core/time/now';
import { entryId, entryRepo, goalRepo, setEntry } from '../repo';
import HabitsPage from '../routes/HabitsPage';

const DAY = '2026-11-03'; // Tuesday
const draw = (url = '/habits') =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <HabitsPage />
    </MemoryRouter>,
  );
const water = () =>
  goalRepo.create({
    name: 'Wasser trinken',
    kind: 'count',
    target: 8,
    unit: 'Gläser',
    period: 'day',
    weeklyTimes: 3,
    order: 0,
  });

beforeEach(async () => {
  setNow(() => new Date(2026, 10, 3, 10, 0).getTime());
  await db.table('habits_goal').clear();
  await db.table('habits_entry').clear();
  await db.table('_settings').clear();
});
afterEach(() => {
  cleanup();
  setNow();
});

describe('Habits page', () => {
  it('starts with an empty state and an add button', async () => {
    draw();
    expect(await screen.findByText('Noch keine Gewohnheiten.')).toBeVisible();
  });

  it('a tap on +1 counts one glass; the menu takes it back and sets a rest day', async () => {
    const g = await water();
    draw();
    const card = await screen.findByTestId('habit-card');
    expect(within(card).getByText('0 von 8 Gläser')).toBeVisible();
    await userEvent.click(within(card).getByRole('button', { name: '+1 Wasser trinken' }));
    await waitFor(async () => expect((await entryRepo.get(entryId(g.id, DAY)))?.count).toBe(1));
    await userEvent.click(within(card).getByRole('button', { name: 'Wasser trinken' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Pausentag' }));
    await waitFor(async () => {
      const e = await entryRepo.get(entryId(g.id, DAY));
      expect(e?.skipped).toBe(true);
      expect(e?.count).toBe(0);
    });
    expect(await screen.findByText('Pausentag: heute zählt nicht.')).toBeVisible();
  });

  it('a yes/no goal toggles done and back', async () => {
    const g = await goalRepo.create({
      name: 'Dehnen',
      kind: 'yesno',
      target: 1,
      period: 'day',
      weeklyTimes: 3,
      order: 0,
    });
    draw();
    await userEvent.click(await screen.findByRole('button', { name: 'Dehnen: Erledigt' }));
    await waitFor(async () => expect((await entryRepo.get(entryId(g.id, DAY)))?.count).toBe(1));
    await userEvent.click(await screen.findByRole('button', { name: 'Dehnen: Erledigt' }));
    await waitFor(async () => expect((await entryRepo.get(entryId(g.id, DAY)))?.count).toBe(0));
  });

  it('creates the water goal from the template, with a reminder window', async () => {
    draw('/habits?new=1');
    await userEvent.click(await screen.findByRole('button', { name: 'Wasser trinken' }));
    await userEvent.click(screen.getByRole('button', { name: 'Speichern' }));
    await waitFor(async () => {
      const [goal] = await goalRepo.active().toArray();
      expect(goal).toMatchObject({
        name: 'Wasser trinken',
        kind: 'count',
        target: 8,
        unit: 'Gläser',
        reminder: { kind: 'window', from: '09:00', to: '19:00', everyMin: 120 },
      });
    });
  });

  it('shows the last 30 days without counting rest days against the goal', async () => {
    const g = await water();
    await setEntry(g.id, '2026-11-02', { count: 8 });
    await setEntry(g.id, '2026-11-01', { count: 0, skipped: true });
    await setEntry(g.id, '2026-10-31', { count: 3 });
    draw('/habits?view=history');
    // 30 days (4 Oct – 3 Nov), minus the one rest day: 29 count, one of them is done.
    await waitFor(() =>
      expect(screen.getByTestId('habit-rate')).toHaveTextContent('1 von 29 geplanten Tagen'),
    );
  });

  it('archives a goal and brings it back from the archive', async () => {
    await water();
    draw();
    const card = await screen.findByTestId('habit-card');
    await userEvent.click(within(card).getByRole('button', { name: 'Wasser trinken' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Archivieren' }));
    await waitFor(async () => expect((await goalRepo.active().toArray())[0]?.archived).toBe(true));
    cleanup();
    draw('/habits?view=archive');
    await userEvent.click(await screen.findByRole('button', { name: 'Wiederherstellen' }));
    await waitFor(async () =>
      expect((await goalRepo.active().toArray())[0]?.archived).toBeUndefined(),
    );
  });
});
