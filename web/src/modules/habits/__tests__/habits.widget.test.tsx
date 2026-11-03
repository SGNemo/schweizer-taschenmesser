// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { setNow, today } from '@/core/time/now';
import { entryId, entryRepo, goalRepo } from '../repo';
import HabitsWidget from '../widgets/HabitsWidget';

const draw = () =>
  render(
    <MemoryRouter>
      <HabitsWidget />
    </MemoryRouter>,
  );

beforeEach(async () => {
  setNow(() => new Date(2026, 10, 3, 10, 0).getTime());
  await db.table('habits_goal').clear();
  await db.table('habits_entry').clear();
});
afterEach(() => {
  cleanup();
  setNow();
});

describe('habits widget', () => {
  it('shows an empty state with an action', async () => {
    draw();
    expect(await screen.findByRole('link', { name: 'Gewohnheit anlegen' })).toHaveAttribute(
      'href',
      '/habits?new=1',
    );
  });

  it("shows today's progress and one tap adds a glass", async () => {
    const g = await goalRepo.create({
      name: 'Wasser trinken',
      kind: 'count',
      target: 8,
      unit: 'Gläser',
      period: 'day',
      weeklyTimes: 3,
      order: 0,
    });
    draw();
    expect(await screen.findByText('Wasser trinken')).toBeVisible();
    expect(screen.getByText('0 von 8 Gläser')).toBeVisible();
    await userEvent.click(screen.getByRole('button', { name: '+1 Wasser trinken' }));
    await waitFor(async () => expect((await entryRepo.get(entryId(g.id, today())))?.count).toBe(1));
    expect(await screen.findByText('1 von 8 Gläser')).toBeVisible();
  });
});
