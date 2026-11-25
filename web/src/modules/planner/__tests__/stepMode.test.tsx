// @vitest-environment jsdom
/**
 * „Los“ in step mode (planner hub 2, package 5a; hand-off 05 „Tests“): only the next open step; „Fertig · weiter“ ticks it
 * as its own undo entry (B26); skip, pause and a reload keep the round's place; on the last open step B23 „Fertig“
 * finishes the step and ticks the ToDo in one undo entry and returns to the plan; S and P work only on the stage's
 * buttons (WCAG 2.1.4). The rule of planner rethink §7: every step tick is one undo entry, the last one included.
 */
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { resetUndoJournal, undoDepth, undoLast } from '@/core/undo';
import { db } from '@/core/db/db';
import { createCollectionRepo } from '@/core/db/repo';
import { getManifest } from '@/core/modules/registry';
import { setNow } from '@/core/time/now';
import { useUiStore } from '@/stores/ui';
import { assignmentRepo } from '../repo';
import FocusPage from '../routes/FocusPage';
import { setManifestsForTests } from '../services';

const NOW = new Date(2026, 10, 9, 10, 0).getTime(); // Monday 2026-11-09
const DAY = '2026-11-09';
const taskRepo = createCollectionRepo(getManifest('todos')!, 'task');
const mod = (id: string) => ({
  id,
  enabled: true,
  dataPolicy: null,
  createdAt: 1,
  updatedAt: 1,
  deviceId: 't',
  deletedAt: null,
  _f: {},
});

async function place(title: string, order: number, extra: Record<string, unknown> = {}) {
  const task = await taskRepo.create({
    listId: 'inbox',
    title,
    done: false,
    priority: 0,
    order,
    estimateMin: 30,
    ...extra,
  });
  await assignmentRepo.upsert(`todos:${task.id}#0`, {
    itemKey: `todos:${task.id}`,
    k: 0,
    of: 1,
    date: DAY,
    minutes: 30,
    order,
    reason: 'new',
  });
  return task.id;
}

const CHECK = ['Wäsche anstellen', 'Bad wischen', 'Müll rausbringen'].map((text, i) => ({
  id: `c${i}`,
  text,
  done: false,
}));

function page(id: string, state?: unknown) {
  const path = `/planner/focus/${encodeURIComponent(`todos:${id}#0`)}?step=1`;
  return render(
    <MemoryRouter
      initialEntries={[state ? { pathname: path.split('?')[0]!, search: '?step=1', state } : path]}
    >
      <Routes>
        <Route path="/planner/focus/:item" element={<FocusPage />} />
        <Route path="/planner" element={<p>Planer-Seite</p>} />
      </Routes>
    </MemoryRouter>,
  );
}
const checklist = async (id: string) =>
  ((await taskRepo.get(id)) as unknown as { checklist: { done: boolean }[] }).checklist.map(
    (c) => c.done,
  );
const toasts = () => useUiStore.getState().toasts.map((x) => x.message);

beforeEach(async () => {
  setNow(() => NOW);
  for (const t of [
    'planner_day',
    'planner_item',
    'planner_assignment',
    'todos_task',
    '_meta',
    '_settings',
  ])
    await db.table(t).clear();
  await db.table('_modules').clear();
  await db.table('_modules').bulkPut([mod('todos'), mod('planner')]);
  useUiStore.setState({ toasts: [] });
  resetUndoJournal();
  sessionStorage.clear();
  setManifestsForTests(async () => [getManifest('todos')!]);
});
afterEach(() => {
  cleanup();
  setNow();
});

describe('„Los“ – step mode', () => {
  it('shows only the next step; „Fertig · weiter“ is one undo entry each, with B26', async () => {
    const id = await place('Haushalt', 0, { checklist: CHECK });
    page(id);
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Wäsche anstellen' }),
    ).toBeInTheDocument();
    expect(screen.getByText('Haushalt · Schritt 1 von 3')).toBeInTheDocument();
    // No list of the other steps, no ring, no clock.
    expect(screen.queryByText('Bad wischen')).toBeNull();
    expect(screen.queryByRole('timer')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Fertig · weiter' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Bad wischen' }),
    ).toBeInTheDocument();
    expect(await checklist(id)).toEqual([true, false, false]);
    await waitFor(() => expect(undoDepth()).toBe(1));
    await waitFor(() => expect(toasts()).toContain('Schritt erledigt.'));
    // The change is said politely (B24).
    await waitFor(() =>
      expect(screen.getByRole('status')).toHaveTextContent('Schritt 2 von 3: Bad wischen'),
    );
    await undoLast();
    expect(await checklist(id)).toEqual([false, false, false]);
  });

  it('skip and pause keep their place across a reload; S and P only on the stage buttons', async () => {
    const id = await place('Haushalt', 0, { checklist: CHECK });
    const first = page(id);
    await screen.findByRole('heading', { level: 1, name: 'Wäsche anstellen' });
    // S in the page (not on a stage button) does nothing.
    fireEvent.keyDown(document.body, { key: 's' });
    expect(screen.getByRole('heading', { level: 1, name: 'Wäsche anstellen' })).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Fertig · weiter' }), { key: 's' });
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Bad wischen' }),
    ).toBeInTheDocument();
    fireEvent.keyDown(screen.getByRole('button', { name: 'Fertig · weiter' }), { key: 'p' });
    expect(screen.getByRole('button', { name: 'Weiter' })).toBeInTheDocument();
    // Paused says so: the filled button does nothing until „Weiter“.
    expect(screen.getAllByText('Pausiert.').length).toBeGreaterThan(0);
    first.unmount();
    page(id);
    // The reload: still on the step after the skipped one, still paused; nothing was written.
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Bad wischen' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Weiter' })).toBeInTheDocument();
    expect(await checklist(id)).toEqual([false, false, false]);
  });

  it('the last open step: B23 „Fertig“ ticks step and ToDo in one undo entry and returns to the plan', async () => {
    const id = await place('Haushalt', 0, {
      checklist: CHECK.map((c, i) => ({ ...c, done: i < 2 })),
    });
    page(id);
    await screen.findByRole('heading', { level: 1, name: 'Müll rausbringen' });
    fireEvent.click(screen.getByRole('button', { name: 'Fertig' }));
    expect(await screen.findByText('Planer-Seite')).toBeInTheDocument();
    expect(await checklist(id)).toEqual([true, true, true]);
    expect((await taskRepo.get(id))?.done).toBe(true);
    await waitFor(() => expect(undoDepth()).toBe(1));
    await waitFor(() => expect(toasts()).toContain('Erledigt'));
    await undoLast();
    expect(await checklist(id)).toEqual([true, true, false]);
    expect((await taskRepo.get(id))?.done).toBe(false);
  });

  it('only skipped steps left: B10 „Jetzt“ walks them again, „Später“ returns with them open', async () => {
    const id = await place('Haushalt', 0, { checklist: CHECK.slice(0, 1) });
    page(id);
    await screen.findByRole('heading', { level: 1, name: 'Wäsche anstellen' });
    fireEvent.click(screen.getByRole('button', { name: 'Überspringen' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: '1 übersprungen. Jetzt oder später?' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('1 übersprungen. Jetzt oder später?');
    fireEvent.click(screen.getByRole('button', { name: 'Jetzt' }));
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Wäsche anstellen' }),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Überspringen' }));
    fireEvent.click(await screen.findByRole('button', { name: 'Später' }));
    expect(await screen.findByText('Planer-Seite')).toBeInTheDocument();
    expect(await checklist(id)).toEqual([false]);
  });

  it('focus lands on the filled button; an explicit „Los“ starts the round fresh, a reload does not', async () => {
    const id = await place('Haushalt', 0, { checklist: CHECK });
    const first = page(id);
    await screen.findByRole('heading', { level: 1, name: 'Wäsche anstellen' });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Fertig · weiter' })).toHaveFocus(),
    );
    fireEvent.keyDown(screen.getByRole('button', { name: 'Fertig · weiter' }), { key: 's' });
    fireEvent.keyDown(screen.getByRole('button', { name: 'Fertig · weiter' }), { key: 'p' });
    first.unmount();
    // „Los“ from the plan again (STEPS_FRESH): the first step, not paused.
    page(id, { stepsFresh: true });
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Wäsche anstellen' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Pause' })).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Fertig · weiter' })).toHaveFocus(),
    );
  });

  it("a step's undo takes back only that step (one ticked elsewhere since stays)", async () => {
    const id = await place('Haushalt', 0, { checklist: CHECK });
    page(id);
    await screen.findByRole('heading', { level: 1, name: 'Wäsche anstellen' });
    fireEvent.click(screen.getByRole('button', { name: 'Fertig · weiter' }));
    await screen.findByRole('heading', { level: 1, name: 'Bad wischen' });
    await waitFor(() => expect(undoDepth()).toBe(1));
    // Another device ticks the third line meanwhile.
    const task = (await taskRepo.get(id)) as unknown as { checklist: typeof CHECK };
    await taskRepo.update(id, {
      checklist: task.checklist.map((c, i) => (i === 2 ? { ...c, done: true } : c)),
    });
    await undoLast();
    expect(await checklist(id)).toEqual([false, false, true]);
  });

  it('after „Rückgängig“ on the stage, the same step can be ticked again', async () => {
    const id = await place('Haushalt', 0, { checklist: CHECK });
    page(id);
    await screen.findByRole('heading', { level: 1, name: 'Wäsche anstellen' });
    fireEvent.click(screen.getByRole('button', { name: 'Fertig · weiter' }));
    await screen.findByRole('heading', { level: 1, name: 'Bad wischen' });
    await waitFor(() => expect(undoDepth()).toBe(1));
    await undoLast();
    await screen.findByRole('heading', { level: 1, name: 'Wäsche anstellen' });
    fireEvent.click(screen.getByRole('button', { name: 'Fertig · weiter' }));
    await screen.findByRole('heading', { level: 1, name: 'Bad wischen' });
    expect(await checklist(id)).toEqual([true, false, false]);
  });
});
