// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useLiveQuery } from 'dexie-react-hooks';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import { createCollectionRepo } from '@/core/db/repo';
import * as contributions from '@/core/modules/contributions';
import { getManifest } from '@/core/modules/registry';
import type { ResolvedState } from '@/core/modules/types';
import { getPlatform } from '@/core/platform';
import { undoLast } from '@/core/undo';
import { TaskEditor } from '../components/TaskEditor';
import { taskRepo } from '../repo';

const events = createCollectionRepo(getManifest('calendar')!, 'event');
const base = { listId: 'inbox', done: false, priority: 0, order: 0 };
type StoredTask = Awaited<ReturnType<typeof taskRepo.create>>;

function Where() {
  const loc = useLocation();
  return <output data-testid="where">{loc.pathname + loc.search}</output>;
}

/** As on the page: the open editor gets the live record. */
function LiveEditor({ first }: { first: StoredTask }) {
  const task = useLiveQuery(() => taskRepo.get(first.id), [first.id]) ?? first;
  return <TaskEditor task={task} subtasks={[]} lists={[]} onClose={() => {}} />;
}

const show = (task: StoredTask) =>
  render(
    <MemoryRouter>
      <LiveEditor first={task} />
      <Where />
    </MemoryRouter>,
  );

const event = (title: string) => events.create({ title, allDay: true, startDate: '2026-11-17' });
const stored = async (id: string) => (await taskRepo.get(id))?.links?.map((l) => l.label);

beforeEach(async () => {
  for (const t of ['todos_task', 'calendar_event', '_modules', '_meta']) await db.table(t).clear();
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

it('an alive link shows the target’s title of today and opens its route', async () => {
  const e = await event('Zahnarzt neu');
  const task = await taskRepo.create({
    ...base,
    title: 'Vorbereiten',
    links: [{ kind: 'event', id: e.id, label: 'Zahnarzt' }],
  });
  show(task);
  await userEvent.click(await screen.findByRole('button', { name: 'Termin: Zahnarzt neu' }));
  expect(screen.getByTestId('where').textContent).toBe(`/calendar?open=${e.id}`);
});

it('while the answer loads the link is already a button, only not usable yet', async () => {
  vi.spyOn(contributions, 'useResolvedLinks').mockReturnValue(undefined);
  const task = await taskRepo.create({
    ...base,
    title: 'Laden',
    links: [{ kind: 'event', id: 'e1', label: 'Zahnarzt' }],
  });
  show(task);
  expect(await screen.findByRole('button', { name: 'Termin: Zahnarzt' })).toBeDisabled();
});

it('a gone link says so; removing takes only that entry off the task, at once and with undo', async () => {
  const e = await event('Bleibt');
  const task = await taskRepo.create({
    ...base,
    title: 'Aufräumen',
    links: [
      { kind: 'event', id: 'deleted-long-ago', label: '<b>Alter Termin</b>' },
      { kind: 'event', id: e.id, label: 'Bleibt' },
    ],
  });
  show(task);
  // The label is text, never markup.
  const row = (await screen.findByText(/Gibt es nicht mehr\./)).closest('li')!;
  expect(row.textContent).toContain('Termin: <b>Alter Termin</b> · Gibt es nicht mehr.');
  expect(row.querySelector('b')).toBeNull();
  await userEvent.click(within(row).getByRole('button', { name: '<b>Alter Termin</b> entfernen' }));
  await waitFor(async () => expect(await stored(task.id)).toEqual(['Bleibt']));
  await waitFor(() => expect(screen.queryByText(/Gibt es nicht mehr\./)).toBeNull());
  // The focus moves to the remove control of the row that is left, not to the dialog body.
  await waitFor(() =>
    expect(screen.getByRole('button', { name: 'Bleibt entfernen' })).toHaveFocus(),
  );
  expect(await undoLast()).toBeTruthy();
  expect(await stored(task.id)).toHaveLength(2);
});

it('one remove behaviour for every row: an alive link goes at once too, and an undo survives „Speichern“', async () => {
  const [a, b] = [await event('Erster'), await event('Zweiter')];
  const task = await taskRepo.create({
    ...base,
    title: 'Beides',
    links: [
      { kind: 'event', id: a.id, label: 'Erster' },
      { kind: 'event', id: b.id, label: 'Zweiter' },
    ],
  });
  show(task);
  await userEvent.click(await screen.findByRole('button', { name: 'Erster entfernen' }));
  // Written without „Speichern“.
  await waitFor(async () => expect(await stored(task.id)).toEqual(['Zweiter']));
  // Undo while the editor is still open: the row comes back …
  expect(await undoLast()).toBeTruthy();
  expect(await screen.findByRole('button', { name: 'Termin: Erster' })).toBeInTheDocument();
  // … and saving something else does not take it away again.
  await userEvent.selectOptions(screen.getByLabelText('Priorität'), '2');
  await userEvent.click(screen.getByRole('button', { name: /^(Speichern|.+ eintragen)$/ }));
  await waitFor(async () => expect((await taskRepo.get(task.id))?.priority).toBe(2));
  expect(await stored(task.id)).toEqual(['Erster', 'Zweiter']);
});

it('a link into a module that is not here shows the label; „Im Browser öffnen“ only with an address', async () => {
  const openUrl = vi.spyOn(getPlatform().app, 'openUrl').mockResolvedValue(undefined);
  const task = await taskRepo.create({
    ...base,
    title: 'Antworten',
    links: [
      // Mail is desktop only (not on the test's web platform); notes are off by default.
      { kind: 'mail', id: 'thread-1', label: 'Betreff der Mail' },
      { kind: 'note', id: 'n1', label: 'Notizzettel' },
    ],
  });
  show(task);
  const note = (await screen.findByText('Notiz: Notizzettel')).closest('li')!;
  expect(within(note).queryByRole('button', { name: 'Im Browser öffnen' })).toBeNull();
  const mail = screen.getByText('Mail: Betreff der Mail').closest('li')!;
  // No provider is registered in this test, so there is no address and no button; nothing opens by itself.
  expect(within(mail).queryByRole('button', { name: 'Im Browser öffnen' })).toBeNull();
  expect(openUrl).not.toHaveBeenCalled();
});

it('„Nicht auf diesem Gerät.“ only where the browser is offered; a target that cannot be told shows its label alone', async () => {
  const openUrl = vi.spyOn(getPlatform().app, 'openUrl').mockResolvedValue(undefined);
  const states = new Map<string, ResolvedState>([
    ['mail:t1', { state: 'elsewhere', url: 'https://mail.example/#all/t1' }],
    ['notes:n1', { state: 'elsewhere' }],
  ]);
  vi.spyOn(contributions, 'useResolvedLinks').mockReturnValue(states);
  const task = await taskRepo.create({
    ...base,
    title: 'Woanders',
    links: [
      { kind: 'mail', id: 't1', label: 'Mahnung' },
      { kind: 'note', id: 'n1', label: 'Zettel' },
    ],
  });
  show(task);
  const mail = (await screen.findByText('Mail: Mahnung · Nicht auf diesem Gerät.')).closest('li')!;
  expect(screen.getByText('Notiz: Zettel')).toBeInTheDocument();
  expect(openUrl).not.toHaveBeenCalled();
  await userEvent.click(within(mail).getByRole('button', { name: 'Im Browser öffnen' }));
  expect(openUrl).toHaveBeenCalledWith('https://mail.example/#all/t1');
});
