// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { patchFocusSettings } from '@/core/settings/focus';
import { getFocusSession } from '@/core/focus/state';
import { setNow } from '@/core/time/now';
import { taskRepo } from '../repo';
import NextWidget from '../widgets/NextWidget';

const base = { listId: 'inbox', done: false, priority: 0, order: 0 };
const NOW = new Date(2026, 9, 2, 10, 0).getTime();

function renderWidget() {
  return render(
    <MemoryRouter>
      <NextWidget />
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  setNow(() => NOW);
  await db.table('todos_task').clear();
  await db.table('_settings').clear();
  await db.table('_meta').clear();
});
afterEach(() => {
  cleanup();
  setNow();
});

describe('NextWidget (Jetzt dran)', () => {
  it('suggests one task, "Etwas anderes" shows the next one, "Anfangen" starts a focus session', async () => {
    await taskRepo.create({
      ...base,
      title: 'Formular ausfüllen',
      dueDate: '2026-10-02',
      estimateMin: 10,
    });
    await taskRepo.create({ ...base, title: 'Fenster putzen', dueDate: '2026-10-03' });
    renderWidget();
    const card = await screen.findByTestId('next-card');
    expect(card).toHaveTextContent('Formular ausfüllen');
    expect(card).toHaveTextContent('etwa 10 Min');
    fireEvent.click(screen.getByRole('button', { name: 'Etwas anderes' }));
    await waitFor(() =>
      expect(screen.getByTestId('next-card')).toHaveTextContent('Fenster putzen'),
    );
    fireEvent.click(screen.getByRole('button', { name: /Anfangen · 25 Min/ }));
    await waitFor(async () => expect((await getFocusSession())?.title).toBe('Fenster putzen'));
  });

  it('shows the day plan with its limit and what is done today', async () => {
    for (const title of ['A', 'B', 'C'])
      await taskRepo.create({ ...base, title, plannedFor: '2026-10-02' });
    const done = await taskRepo.create({ ...base, title: 'Erledigt', plannedFor: '2026-10-02' });
    await taskRepo.update(done.id, { done: true, completedAt: NOW });
    renderWidget();
    const plan = await screen.findByTestId('day-plan');
    expect(plan).toHaveTextContent('3 Dinge reichen für heute.');
    expect(plan).toHaveTextContent('Erledigt heute: 1');
  });

  it('says so, friendly, when everything is done', async () => {
    const t = await taskRepo.create({ ...base, title: 'Fertig' });
    await taskRepo.update(t.id, { done: true, completedAt: NOW });
    renderWidget();
    expect(await screen.findByText('Alles erledigt. Zeit für etwas Schönes.')).toBeInTheDocument();
  });

  it('can be switched off completely', async () => {
    await taskRepo.create({ ...base, title: 'X', dueDate: '2026-10-02' });
    await patchFocusSettings({ nextOne: false, dayPlan: false });
    renderWidget();
    expect(await screen.findByText('Die Vorschläge sind ausgeschaltet.')).toBeInTheDocument();
    expect(screen.queryByTestId('next-card')).toBeNull();
  });

  it('can hide only the day plan', async () => {
    await taskRepo.create({ ...base, title: 'X', dueDate: '2026-10-02' });
    await patchFocusSettings({ dayPlan: false });
    renderWidget();
    await screen.findByTestId('next-card');
    expect(screen.queryByTestId('day-plan')).toBeNull();
  });
});
