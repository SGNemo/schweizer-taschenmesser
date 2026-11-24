// @vitest-environment jsdom
/**
 * The list's plan panel (planner hub 2, package 4a, hand-off 04): open entries as tick lines under section heads, 8 and
 * then X19 „n weitere“, each tick Listen's own write with its own undo, X8 „Fertig eingekauft“ once nothing is open, X3
 * for a list that is gone. Mounted through the host, as the planner does.
 */
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { PlanPanelHost } from '@/core/modules/PlanPanelHost';
import { resetUndoJournal, undoLast } from '@/core/undo';
import { itemRepo, listRepo } from '../repo';

const LIST = 'shop';

beforeEach(async () => {
  for (const t of ['lists_list', 'lists_item', '_modules']) await db.table(t).clear();
  await db.table('_modules').put({
    id: 'lists',
    enabled: true,
    dataPolicy: null,
    createdAt: 1,
    updatedAt: 1,
    deviceId: 't',
    deletedAt: null,
    _f: {},
  });
  resetUndoJournal();
  await listRepo.create({ name: 'Einkauf', kind: 'shopping', order: 0 }, { id: LIST });
});

const items = (names: string[], extra: Record<string, unknown> = {}) =>
  Promise.all(
    names.map((name, i) =>
      itemRepo.create({ listId: LIST, name, done: false, order: i, ...extra }, { id: `i${i}` }),
    ),
  );

const panel = (id = LIST) =>
  render(
    <MemoryRouter>
      <PlanPanelHost moduleId="lists" id={id} to={`/lists?open=${id}`} />
    </MemoryRouter>,
  );

it('shows 8 open entries, then „n weitere“ adds 8 more; no scroll box', async () => {
  await items(Array.from({ length: 20 }, (_, i) => `Ding ${i + 1}`));
  panel();
  expect(await screen.findByText('Ding 1')).toBeInTheDocument();
  expect(screen.getAllByRole('checkbox')).toHaveLength(8);
  fireEvent.click(screen.getByRole('button', { name: '12 weitere' }));
  expect(screen.getAllByRole('checkbox')).toHaveLength(16);
  fireEvent.click(screen.getByRole('button', { name: '4 weitere' }));
  expect(screen.getAllByRole('checkbox')).toHaveLength(20);
  expect(screen.queryByRole('button', { name: /weitere/ })).toBeNull();
  expect(screen.getByRole('button', { name: 'Ganz öffnen' })).toBeInTheDocument();
});

it('section heads only when sections are used', async () => {
  await itemRepo.create({ listId: LIST, name: 'Milch', done: false, order: 0, section: 'dairy' });
  await itemRepo.create({ listId: LIST, name: 'Brot', done: false, order: 1 });
  panel();
  expect(await screen.findByText('Milch')).toBeInTheDocument();
  expect(screen.getByText('Ohne Bereich')).toBeInTheDocument();
});

it('a tick is Listen’s own write with its own undo', async () => {
  await items(['Milch', 'Brot']);
  panel();
  const tick = await screen.findByRole('checkbox', { name: '„Milch“ abhaken' });
  fireEvent.click(tick);
  await waitFor(async () => expect((await itemRepo.get('i0'))?.done).toBe(true));
  expect(tick).toBeChecked();
  expect(await undoLast()).toBe('„Milch“ abgehakt.');
  expect((await itemRepo.get('i0'))?.done).toBe(false);
});

it('nothing open: X8 „Fertig eingekauft“ clears the bought entries, one undo', async () => {
  await items(['Milch', 'Brot'], { done: true });
  panel();
  fireEvent.click(await screen.findByRole('button', { name: 'Fertig eingekauft' }));
  await waitFor(async () => expect(await itemRepo.get('i0')).toBeUndefined());
  await undoLast();
  expect((await itemRepo.get('i0'))?.done).toBe(true);
});

it('a list that is gone (or a foreign id): X3 and no lines', async () => {
  panel('nope');
  expect(await screen.findByText('Gibt es nicht mehr.')).toBeInTheDocument();
  expect(screen.queryByRole('checkbox')).toBeNull();
});
