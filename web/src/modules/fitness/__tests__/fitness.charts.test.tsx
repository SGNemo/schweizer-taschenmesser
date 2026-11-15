// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { setNow } from '@/core/time/now';
import { ExercisesView } from '../components/ExercisesView';
import { WeekView } from '../components/WeekView';
import { sessionRepo } from '../repo';

describe('fitness charts', () => {
  beforeEach(async () => {
    setNow(() => new Date(2026, 10, 8, 12, 0).getTime());
    await db.table('fitness_session').clear();
  });
  afterEach(() => setNow());

  it('shows the course of an exercise from two sessions on, one point is only the best', async () => {
    await sessionRepo.create({
      date: '2026-11-01',
      exercises: [{ name: 'Kniebeuge', sets: 3, reps: 5, weightKg: 80 }],
    });
    await sessionRepo.create({
      date: '2026-11-07',
      exercises: [
        { name: 'Kniebeuge', sets: 3, reps: 5, weightKg: 85 },
        { name: 'Dips', reps: 10 },
      ],
    });
    render(
      <MemoryRouter>
        <ExercisesView day="2026-11-08" />
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByText('Kniebeuge'));
    const trend = await screen.findByRole('figure', { name: 'Schwerstes Gewicht je Einheit' });
    expect(within(trend).getAllByText(/85 kg/).length).toBeGreaterThan(0);
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
  });

  it('draws sets per muscle group and kcal per day without any goal mark', () => {
    render(
      <WeekView
        day="2026-11-08"
        weekStart={1}
        sessions={[
          {
            date: '2026-11-03',
            exercises: [
              { name: 'Kniebeuge', sets: 4, reps: 5 },
              { name: 'Laufen', durationMin: 30 },
            ],
          },
        ]}
        meals={[{ date: '2026-11-03', text: 'Brot', kcal: 2600 }]}
        nutrition
        loadedFrom="2026-08-01"
      />,
    );
    const groups = screen.getByRole('figure', { name: 'Sätze je Muskelgruppe' });
    expect(within(groups).getAllByText(/4 Sätze/).length).toBeGreaterThan(0);
    expect(screen.getByTestId('fitness-week-minutes').textContent).toBe(
      'Je Muskelgruppe: Ausdauer 30 Min',
    );
    const kcal = screen.getByRole('figure', { name: 'kcal je Tag' });
    // Eating is never „over“: no target, no „drüber“.
    expect(kcal.textContent).not.toMatch(/drüber|Geplant/);
  });
});
