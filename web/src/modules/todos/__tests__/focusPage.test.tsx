// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { startSession } from '@/core/focus/session';
import { getFocusSession, saveFocusSession } from '@/core/focus/state';
import { setNow } from '@/core/time/now';
import FocusPage from '../routes/FocusPage';
import { taskRepo } from '../repo';

const NOW = new Date(2026, 9, 2, 10, 0).getTime();
const base = { listId: 'inbox', done: false, priority: 0, order: 0 };

function renderAt(id: string) {
  return render(
    <MemoryRouter initialEntries={[`/todos/focus/${id}`]}>
      <Routes>
        <Route path="/todos/focus/:taskId" element={<FocusPage />} />
        <Route path="/" element={<p>Übersicht-Platzhalter</p>} />
        <Route path="/todos" element={<p>ToDos-Platzhalter</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(async () => {
  setNow(() => NOW);
  await db.table('todos_task').clear();
  await db.table('todos_list').clear();
  await db.table('_settings').clear();
  await db.table('_meta').clear();
});
afterEach(() => {
  cleanup();
  setNow();
});

describe('FocusPage', () => {
  it('offers to start a round and shows the ring timer afterwards', async () => {
    const t = await taskRepo.create({ ...base, title: 'Formular ausfüllen', estimateMin: 10 });
    renderAt(t.id);
    fireEvent.click(await screen.findByRole('button', { name: 'Fokus starten · 10 Min' }));
    expect(await screen.findByRole('timer')).toHaveTextContent('10:00');
    expect((await getFocusSession())?.taskId).toBe(t.id);
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Formular ausfüllen');
  });

  it('pauses, resumes and extends by five minutes', async () => {
    const t = await taskRepo.create({ ...base, title: 'X' });
    await saveFocusSession(startSession({ id: t.id, title: 'X' }, 25, NOW, `/todos/focus/${t.id}`));
    renderAt(t.id);
    await screen.findByRole('timer');
    fireEvent.click(screen.getByRole('button', { name: 'Pause' }));
    await waitFor(async () => expect((await getFocusSession())?.endAt).toBeUndefined());
    expect(await screen.findByRole('button', { name: 'Weiter' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '+5 Min' }));
    await waitFor(async () => expect((await getFocusSession())?.leftMs).toBe(30 * 60_000));
    fireEvent.click(screen.getByRole('button', { name: 'Weiter' }));
    await waitFor(async () => expect((await getFocusSession())?.endAt).toBe(NOW + 30 * 60_000));
  });

  it('asks gently when the time is up and keeps the round open', async () => {
    const t = await taskRepo.create({ ...base, title: 'X' });
    await saveFocusSession(startSession({ id: t.id, title: 'X' }, 1, NOW - 5 * 60_000));
    renderAt(t.id);
    expect(
      await screen.findByText('Zeit ist um. Noch fünf Minuten oder fertig?'),
    ).toBeInTheDocument();
    expect(await getFocusSession()).toBeDefined();
  });

  it('"Fertig" ticks the task off, ends the round and leaves', async () => {
    const t = await taskRepo.create({ ...base, title: 'X' });
    await saveFocusSession(startSession({ id: t.id, title: 'X' }, 25, NOW));
    renderAt(t.id);
    fireEvent.click(await screen.findByRole('button', { name: 'Fertig' }));
    expect(await screen.findByText('Übersicht-Platzhalter')).toBeInTheDocument();
    expect((await taskRepo.get(t.id))?.done).toBe(true);
    expect(await getFocusSession()).toBeUndefined();
  });

  it('"Runde beenden" ends the round without touching the task', async () => {
    const t = await taskRepo.create({ ...base, title: 'X' });
    await saveFocusSession(startSession({ id: t.id, title: 'X' }, 25, NOW));
    renderAt(t.id);
    fireEvent.click(await screen.findByRole('button', { name: 'Runde beenden' }));
    expect(await screen.findByText('Übersicht-Platzhalter')).toBeInTheDocument();
    expect((await taskRepo.get(t.id))?.done).toBe(false);
    expect(await getFocusSession()).toBeUndefined();
  });

  it('Esc leaves the screen and the round keeps running', async () => {
    const t = await taskRepo.create({ ...base, title: 'X' });
    await saveFocusSession(startSession({ id: t.id, title: 'X' }, 25, NOW));
    renderAt(t.id);
    await screen.findByRole('timer');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(await screen.findByText('Übersicht-Platzhalter')).toBeInTheDocument();
    expect(await getFocusSession()).toBeDefined();
  });

  it('suggests three small steps and lets the user tick them', async () => {
    const t = await taskRepo.create({ ...base, title: 'X' });
    await saveFocusSession(startSession({ id: t.id, title: 'X' }, 25, NOW));
    renderAt(t.id);
    fireEvent.click(await screen.findByRole('button', { name: 'Vorschlag: 3 kleine Schritte' }));
    const step = await screen.findByRole('checkbox', { name: 'Öffnen und Überblick verschaffen' });
    fireEvent.click(step);
    await waitFor(async () =>
      expect(
        (await taskRepo.active().toArray()).find(
          (x) => x.title === 'Öffnen und Überblick verschaffen',
        )?.done,
      ).toBe(true),
    );
  });

  it('says so when the task is gone', async () => {
    renderAt('missing');
    expect(await screen.findByText('Diese Aufgabe gibt es nicht mehr.')).toBeInTheDocument();
  });
});
