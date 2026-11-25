// @vitest-environment jsdom
/**
 * The row opens instead of jumping (planner hub 2, package 4a, hand-off 04 „Tests“): one compartment at a time, Esc
 * closes it and gives the focus back to the title, a selection never expands, „Zeilen aufklappen“ off keeps the old
 * jump – and the write spy: opening and closing writes nothing anywhere, a tick in a panel writes only the module's
 * own row (the planner writes nothing).
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { createCollectionRepo } from '@/core/db/repo';
import { getManifest } from '@/core/modules/registry';
import { setSettings } from '@/core/settings/settings';
import { setNow } from '@/core/time/now';
import { useUiStore } from '@/stores/ui';
import type { BoardRow } from '../board';
import { ThingRow } from '../components/ThingRow';
import { assignmentRepo } from '../repo';
import PlannerPage from '../routes/PlannerPage';
import { PLANNER_SCOPE } from '../settings';

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

/** Every write in the database while it is on, by table. */
function writeSpy() {
  const writes: string[] = [];
  const off: (() => void)[] = [];
  for (const table of db.tables) {
    const created = () => void writes.push(table.name);
    const updated = () => void writes.push(table.name);
    const deleted = () => void writes.push(table.name);
    table.hook('creating', created);
    table.hook('updating', updated);
    table.hook('deleting', deleted);
    off.push(() => {
      table.hook('creating').unsubscribe(created);
      table.hook('updating').unsubscribe(updated);
      table.hook('deleting').unsubscribe(deleted);
    });
  }
  return { writes, stop: () => off.forEach((f) => f()) };
}

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

function page() {
  return render(
    <MemoryRouter initialEntries={['/planner']}>
      <Routes>
        <Route path="/planner" element={<PlannerPage />} />
        <Route path="/todos" element={<p>ToDos-Seite</p>} />
      </Routes>
    </MemoryRouter>,
  );
}

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
  useUiStore.setState({ closedGroups: [] });
});
afterEach(() => setNow());

describe('expanding a plan row', () => {
  it('one open at a time; Esc closes and returns the focus; opening and closing writes nothing', async () => {
    const id = await place('Haushalt', 0, {
      note: 'Vor dem Besuch.',
      checklist: [
        { id: 'c1', text: 'Bad wischen', done: false },
        { id: 'c2', text: 'Wäsche', done: false },
      ],
    });
    await place('Steuer', 1);
    page();
    const first = await screen.findByRole(
      'button',
      { name: /^Haushalt.*\. Aufklappen$/ },
      { timeout: 5000 },
    );
    // Let the page settle (its own reads and first-visit writes) before the spy listens.
    await new Promise((r) => setTimeout(r, 300));
    const spy = writeSpy();
    expect(first).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(first);
    const box = await screen.findByRole('group', { name: 'Haushalt' });
    expect(first).toHaveAttribute('aria-expanded', 'true');
    expect(first).toHaveAttribute('aria-controls', box.id);
    expect(await within(box).findByText('Vor dem Besuch.')).toBeInTheDocument();
    expect(
      within(box).getByRole('checkbox', { name: '„Bad wischen“ abhaken' }),
    ).toBeInTheDocument();
    // „Erledigt“ is the row's own tick: the panel has none.
    expect(within(box).queryByRole('checkbox', { name: /Erledigt/ })).toBeNull();

    fireEvent.click(screen.getByRole('button', { name: 'Steuer. Aufklappen' }));
    await waitFor(() => expect(screen.getAllByTestId('row-compartment')).toHaveLength(1));
    expect(screen.queryByRole('group', { name: 'Haushalt' })).toBeNull();
    const second = screen.getByRole('button', { name: 'Steuer. Zuklappen' });
    const open = await within(screen.getByTestId('row-compartment')).findByRole('button', {
      name: 'Ganz öffnen',
    });
    fireEvent.keyDown(open, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByTestId('row-compartment')).toBeNull());
    expect(second).toHaveFocus();
    await new Promise((r) => setTimeout(r, 200));
    expect(spy.writes).toEqual([]);

    // A tick in the panel: ToDos' own write, nothing of the planner's.
    fireEvent.click(screen.getByRole('button', { name: /^Haushalt.*\. Aufklappen$/ }));
    const tick = await screen.findByRole('checkbox', { name: '„Bad wischen“ abhaken' });
    fireEvent.click(tick);
    await waitFor(async () =>
      expect(
        ((await taskRepo.get(id))?.checklist as { id: string; done: boolean }[] | undefined)?.find(
          (c) => c.id === 'c1',
        )?.done,
      ).toBe(true),
    );
    spy.stop();
    expect(spy.writes.length).toBeGreaterThan(0);
    // ToDos' row and the sync outbox entry every repo write leaves – no planner table, nothing else.
    expect([...new Set(spy.writes)].sort()).toEqual(['_outbox', 'todos_task']);
    // The thing itself stays open, and the planner never left.
    expect((await taskRepo.get(id))?.done).toBe(false);
    expect(screen.queryByText('ToDos-Seite')).toBeNull();
  });

  it('„Ganz öffnen“ is the old jump', async () => {
    await place('Haushalt', 0);
    page();
    fireEvent.click(
      await screen.findByRole('button', { name: /^Haushalt.*\. Aufklappen$/ }, { timeout: 5000 }),
    );
    fireEvent.click(await screen.findByRole('button', { name: 'Ganz öffnen' }));
    expect(await screen.findByText('ToDos-Seite')).toBeInTheDocument();
  });

  it('„Zeilen aufklappen“ off: the title opens the thing as before', async () => {
    await setSettings(PLANNER_SCOPE, { expandRows: false });
    await place('Haushalt', 0);
    page();
    await screen.findByText('Haushalt', undefined, { timeout: 5000 });
    expect(screen.queryByRole('button', { name: /Aufklappen$/ })).toBeNull();
    const title = document.querySelector<HTMLElement>('[data-row-key^="todos:"] [data-row]')!;
    expect(title).not.toHaveAttribute('aria-expanded');
    fireEvent.click(title);
    expect(await screen.findByText('ToDos-Seite')).toBeInTheDocument();
  });
});

describe('a row that leaves while open', () => {
  it('closes, and the focus goes to the next row’s title', async () => {
    const id = await place('Haushalt', 0);
    await place('Steuer', 1);
    page();
    fireEvent.click(
      await screen.findByRole('button', { name: /^Haushalt.*\. Aufklappen$/ }, { timeout: 5000 }),
    );
    const open = await screen.findByRole('button', { name: 'Ganz öffnen' });
    open.focus();
    // Finished elsewhere (its own lead, a sync): the row leaves the board.
    await taskRepo.update(id, { done: true });
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Steuer. Aufklappen' })).toHaveFocus(),
    );
    expect(screen.queryByTestId('row-compartment')).toBeNull();
  });
});

describe('ThingRow in a selection', () => {
  it('never expands: no disclosure on the title, no compartment', () => {
    const row = {
      unitId: 'todos:a#0',
      itemKey: 'todos:a',
      title: 'Haushalt',
      minutes: 30,
      k: 0,
      of: 1,
      pinned: false,
      entry: { moduleId: 'todos', id: 'a', kind: 'task', title: 'Haushalt', to: '/todos?open=a' },
    } as unknown as BoardRow;
    render(
      <MemoryRouter>
        <ul>
          <ThingRow
            row={row}
            reason=""
            whyOpen={false}
            dueClock={NOW}
            menu={[]}
            select={{ selected: false, onChange: () => undefined }}
            expand={{ open: true, onToggle: () => undefined, onClose: () => undefined }}
          />
        </ul>
      </MemoryRouter>,
    );
    expect(document.querySelector('[aria-expanded]')).toBeNull();
    expect(screen.queryByTestId('row-compartment')).toBeNull();
  });

  it('a thing in parts names its part in the expand button', () => {
    const row = {
      unitId: 'todos:a#1',
      itemKey: 'todos:a',
      title: 'Steuer',
      minutes: 30,
      k: 1,
      of: 2,
      pinned: false,
      entry: { moduleId: 'todos', id: 'a', kind: 'task', title: 'Steuer', to: '/todos?open=a' },
    } as unknown as BoardRow;
    render(
      <MemoryRouter>
        <ul>
          <ThingRow
            row={row}
            reason=""
            whyOpen={false}
            dueClock={NOW}
            menu={[]}
            expand={{ open: false, onToggle: () => undefined, onClose: () => undefined }}
          />
        </ul>
      </MemoryRouter>,
    );
    // The name is what the button shows (the title, its part for the screen reader), then „. Aufklappen“ (WCAG 2.5.3).
    expect(
      screen.getByRole('button', { name: /^Steuer\s*Teil 2 von 2\. Aufklappen$/ }),
    ).toBeInTheDocument();
  });
});
