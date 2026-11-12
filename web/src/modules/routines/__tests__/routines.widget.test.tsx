// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { today } from '@/core/time/dates';
import { useUiStore } from '@/stores/ui';
import { routineRepo } from '../repo';
import RoutinesWidget from '../widgets/RoutinesWidget';

const view = () =>
  render(
    <MemoryRouter>
      <RoutinesWidget />
    </MemoryRouter>,
  );

const weekly = { freq: 'weekly' as const, interval: 1 };

describe('routines widget', () => {
  beforeEach(async () => {
    await db.table('routines_routine').clear();
  });

  it('shows an empty state with an action when there is no routine', async () => {
    view();
    expect(await screen.findByRole('link', { name: 'Routine eintragen' })).toHaveAttribute(
      'href',
      '/routines?new=1',
    );
  });

  it('lists what is due with whose turn it is; a tick moves it on to the next name', async () => {
    const day = today();
    const id = await routineRepo.create({
      name: 'Bad putzen',
      repeat: weekly,
      startDate: day,
      dueDate: day,
      people: ['Mia', 'Ben'],
      turn: 0,
    });
    view();
    const box = await screen.findByRole('checkbox', { name: 'Bad putzen · Mia' });
    await userEvent.click(box);
    // The same toast as on the page: what was done and whose turn it is then.
    await waitFor(() =>
      expect(useUiStore.getState().toasts.map((x) => x.message)).toContain(
        'Bad putzen erledigt. Als Nächstes: Ben.',
      ),
    );
    await waitFor(async () => {
      const r = await routineRepo.get(typeof id === 'string' ? id : id.id);
      expect(r?.turn).toBe(1);
      expect(r!.dueDate > day).toBe(true);
      expect(r?.lastDoneBy).toBe('Mia');
    });
  });

  it('says so calmly when routines exist and none is due', async () => {
    const day = today();
    await routineRepo.create({
      name: 'Fenster putzen',
      repeat: weekly,
      startDate: day,
      dueDate: '2999-01-01',
      people: [],
      turn: 0,
    });
    view();
    expect(await screen.findByText('Heute ist nichts dran.')).toBeInTheDocument();
  });
});
