// @vitest-environment jsdom
import { fireEvent, render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { setNow } from '@/core/time/now';
import { CatalogPicker } from '../components/CatalogPicker';
import { ExercisesView } from '../components/ExercisesView';
import { SessionEditor } from '../components/SessionEditor';
import { sessionRepo } from '../repo';

describe('fitness exercises view', () => {
  beforeEach(async () => {
    setNow(() => new Date(2026, 10, 8, 12, 0).getTime());
    await db.table('fitness_session').clear();
    // Older than the page's 90 days: still the best.
    await sessionRepo.create({
      date: '2026-05-01',
      exercises: [{ name: 'Kniebeuge', sets: 3, reps: 5, weightKg: 100 }],
    });
    await sessionRepo.create({
      date: '2026-11-07',
      exercises: [
        { name: 'Kniebeuge', sets: 3, reps: 5, weightKg: 80 },
        { name: 'Tischtennis', durationMin: 60 },
      ],
    });
    await sessionRepo.create({
      date: '2026-11-09',
      planned: true,
      exercises: [{ name: 'Bankdrücken', sets: 3, reps: 8, weightKg: 60 }],
    });
  });
  afterEach(() => setNow());

  it('lists logged exercises by group with last values and best, never a plan', async () => {
    render(
      <MemoryRouter>
        <ExercisesView day="2026-11-08" />
      </MemoryRouter>,
    );
    const view = await screen.findByTestId('fitness-exercises');
    expect(within(view).getByText('Beine')).toBeInTheDocument();
    expect(within(view).getByText('Weitere')).toBeInTheDocument();
    expect(
      within(view).getByText(/Zuletzt Gestern · 3 × 5 · 80 kg · Bestwert 100 kg × 5$/),
    ).toBeInTheDocument();
    expect(within(view).queryByText('Bankdrücken')).toBeNull();

    fireEvent.change(within(view).getByRole('searchbox'), { target: { value: 'tisch' } });
    expect(within(view).queryByText('Kniebeuge')).toBeNull();
    expect(within(view).getByText('Tischtennis')).toBeInTheDocument();
  });

  it('opens the history with the best marked in words', async () => {
    render(
      <MemoryRouter>
        <ExercisesView day="2026-11-08" />
      </MemoryRouter>,
    );
    fireEvent.click(await screen.findByText('Kniebeuge'));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByTestId('fitness-exercise-best').textContent).toBe(
      'Bestwert 100 kg × 5 · 2-mal eingetragen',
    );
    expect(within(dialog).getByText(/3 × 5 · 100 kg · Bestwert/)).toBeInTheDocument();
  });

  it('shows an empty state without sessions', async () => {
    await db.table('fitness_session').clear();
    render(
      <MemoryRouter>
        <ExercisesView day="2026-11-08" />
      </MemoryRouter>,
    );
    expect(await screen.findByTestId('fitness-exercises-empty')).toBeInTheDocument();
  });
});

describe('fitness catalogue search', () => {
  it('filters catalogue and own names and offers an unknown name as own exercise', () => {
    const picked: string[] = [];
    render(
      <CatalogPicker
        open
        own={['Tischtennis']}
        onPick={(n) => picked.push(n)}
        onClose={() => {}}
      />,
    );
    const box = screen.getByRole('searchbox');
    fireEvent.change(box, { target: { value: 'kreuz' } });
    expect(screen.getByRole('button', { name: 'Kreuzheben hinzufügen' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Bankdrücken hinzufügen' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Tischtennis hinzufügen' })).toBeNull();

    fireEvent.change(box, { target: { value: 'Slackline' } });
    expect(screen.getByRole('status').textContent).toMatch(/Nichts gefunden/);
    fireEvent.click(screen.getByRole('button', { name: '„Slackline“ als eigene Übung' }));
    expect(picked).toEqual(['Slackline']);
  });
});

describe('fitness session form', () => {
  beforeEach(() => setNow(() => new Date(2026, 10, 8, 12, 0).getTime()));
  afterEach(() => setNow());

  it('says what an exercise was last time, never from the session being edited', () => {
    const sessions = [
      {
        id: 'a',
        date: '2026-11-03',
        exercises: [{ name: 'Rudern', sets: 3, reps: 10, weightKg: 50 }],
      },
      {
        id: 'b',
        date: '2026-11-07',
        exercises: [{ name: 'Rudern', sets: 3, reps: 10, weightKg: 55 }],
      },
    ];
    render(
      <SessionEditor
        target={{ ...sessions[1]!, createdAt: 0, updatedAt: 0, deviceId: 'x' } as never}
        sessions={sessions}
        templates={[]}
        onClose={() => {}}
      />,
    );
    expect(screen.getByText(/Letztes Mal \(.*3\. Nov\.\): 3 × 10 · 50 kg/)).toBeInTheDocument();
  });
});
