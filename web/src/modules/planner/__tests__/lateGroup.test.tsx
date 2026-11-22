// @vitest-environment jsdom
/**
 * Planner hub R2 on the page: the group „Frist vorbei“ (card and one row), ⋯ „Verschieben …“ with day chips and
 * the „Warum?“ line of the day's capacity.
 */
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import { createCollectionRepo } from '@/core/db/repo';
import { getManifest } from '@/core/modules/registry';
import { setNow } from '@/core/time/now';
import { useUiStore } from '@/stores/ui';
import type { PlannableEntry } from '@/core/modules/contributions';
import type { BoardDay, BoardRow, WaitingRow } from '../board';
import { capacityWhy } from '../components/capacity';
import { nextDeadlinesOf } from '../components/Context';
import { DayPage } from '../components/DayPage';
import { LateGroup, LateRow } from '../components/LateGroup';
import { assignmentRepo, itemRepo } from '../repo';
import PlannerPage from '../routes/PlannerPage';

const NOW = new Date(2026, 10, 15, 10, 0).getTime(); // Sunday 2026-11-15
const todos = getManifest('todos')!;
const invoices = getManifest('invoices')!;
const taskRepo = createCollectionRepo(todos, 'task');
const invoiceRepo = createCollectionRepo(invoices, 'invoice');

const late = (id: string, due: string, kind = 'invoice'): BoardRow =>
  ({
    unitId: `invoices:${id}#0`,
    itemKey: `invoices:${id}`,
    title: `${id} bezahlen`,
    minutes: 10,
    k: 0,
    of: 1,
    reason: 'deadline',
    late: true,
    approx: false,
    pinned: false,
    hardDue: due,
    entry: {
      moduleId: 'invoices',
      id,
      kind,
      title: `${id} bezahlen`,
      to: `/invoices?open=${id}`,
      due: { date: due, hard: true },
    },
  }) as BoardRow;

const ROWS = [late('Zahnarzt', '2026-11-08'), late('Tischlerei', '2026-11-10')];
const renderRow = (r: BoardRow) => <li key={r.unitId}>{r.title}</li>;

const moduleOn = (id: string) =>
  db.table('_modules').put({
    id,
    enabled: true,
    dataPolicy: null,
    createdAt: 1,
    updatedAt: 1,
    deviceId: 't',
    deletedAt: null,
    _f: {},
  });

beforeEach(async () => {
  setNow(() => NOW);
  for (const t of [
    'planner_day',
    'planner_item',
    'planner_assignment',
    'todos_task',
    'invoices_invoice',
    '_settings',
    '_meta',
    '_modules',
  ])
    await db.table(t).clear();
  await moduleOn('todos');
  await moduleOn('invoices');
});
afterEach(() => setNow());

describe('„Frist vorbei“ as a card (context column)', () => {
  it('is a named region with head, count, one calm sentence and the rows; the danger tone is one hidden icon', () => {
    render(<LateGroup rows={ROWS} renderRow={renderRow} />);
    const card = screen.getByRole('region', { name: /Frist vorbei/ });
    expect(within(card).getByRole('heading', { level: 2 })).toHaveTextContent(
      /^Frist vorbei\s*2 Rechnungen$/,
    );
    expect(card).toHaveTextContent(
      'Liegt auf keinem Tag. Bezahlt ist bezahlt – wann, entscheidest du.',
    );
    const list = within(card).getByRole('list', { name: 'Frist vorbei' });
    expect(
      within(list)
        .getAllByRole('listitem')
        .map((li) => li.textContent),
    ).toEqual(['Zahnarzt bezahlen', 'Tischlerei bezahlen']);
    // One icon carries the tone, and it is decoration: the words say it.
    expect(card.querySelectorAll('svg')).toHaveLength(1);
    expect(card.querySelector('svg')!.closest('[aria-hidden="true"]')).not.toBeNull();
    expect(card.textContent).not.toMatch(/überfällig/i);
  });

  it('one invoice is „1 Rechnung“, other kinds are „Dinge“; no rows: no card', () => {
    const { unmount } = render(<LateGroup rows={ROWS.slice(0, 1)} renderRow={renderRow} />);
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('1 Rechnung');
    unmount();
    const mixed = render(
      <LateGroup rows={[ROWS[0]!, late('Musik', '2026-11-12', 'cancel')]} renderRow={renderRow} />,
    );
    expect(screen.getByRole('heading', { level: 2 })).toHaveTextContent('2 Dinge');
    mixed.unmount();
    const { container } = render(<LateGroup rows={[]} renderRow={renderRow} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('„Frist vorbei“ as one row above the day (phone)', () => {
  it('says the group and its count, folded on arrival; one tap unfolds the rows in place', () => {
    render(<LateRow rows={ROWS} renderRow={renderRow} />);
    const row = screen.getByRole('button', { name: 'Frist vorbei · 2 Rechnungen' });
    expect(row).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByText('Zahnarzt bezahlen')).toBeNull();
    fireEvent.click(row);
    expect(row).toHaveAttribute('aria-expanded', 'true');
    const group = document.getElementById(row.getAttribute('aria-controls')!)!;
    expect(within(group).getAllByRole('listitem')).toHaveLength(2);
    expect(group).toHaveTextContent('Liegt auf keinem Tag.');
    fireEvent.click(row);
    expect(screen.queryByText('Zahnarzt bezahlen')).toBeNull();
  });

  it('no rows: no row', () => {
    const { container } = render(<LateRow rows={[]} renderRow={renderRow} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('the page with late invoices', () => {
  const draw = () =>
    render(
      <MemoryRouter initialEntries={['/planner']}>
        <PlannerPage />
      </MemoryRouter>,
    );
  const invoice = (payee: string, dueDate: string) =>
    invoiceRepo.create({ payee, amountMinor: 8400, dueDate, status: 'open' });
  const placed = (key: string, date: string, order: number, minutes = 30) =>
    assignmentRepo.upsert(`${key}#0`, {
      itemKey: key,
      k: 0,
      of: 1,
      date,
      minutes,
      order,
      reason: 'new',
    });

  it('keeps them off the day and its sum, in the group; the group row has no tick, no „Später“, no move', async () => {
    const task = await taskRepo.create({
      listId: 'inbox',
      title: 'Saugen',
      done: false,
      priority: 0,
      order: 0,
      estimateMin: 30,
    });
    const inv = await invoice('Zahnarzt', '2026-11-08');
    // What a run before R2 left: both on Monday.
    await placed(`todos:${task.id}`, '2026-11-16', 0);
    await placed(`invoices:${inv.id}`, '2026-11-16', 1, 10);
    draw();
    const monday = await screen.findByTestId('day-2026-11-16');
    expect(within(monday).getByText('Saugen')).toBeInTheDocument();
    expect(within(monday).queryByText('Zahnarzt bezahlen')).toBeNull();
    // 30 of 192 minutes are planned: the invoice's ten are not in the day's sum.
    expect(monday).toHaveTextContent('2 h 42 frei von 3 h 12');
    fireEvent.click(screen.getByRole('button', { name: 'Frist vorbei · 1 Rechnung' }));
    const group = await screen.findByTestId('planner-late');
    expect(group).toHaveTextContent('Zahnarzt bezahlen');
    expect(group).toHaveTextContent('Frist war So');
    expect(group.textContent).not.toMatch(/10 Min/);
    expect(within(group).queryByRole('checkbox')).toBeNull();
    fireEvent.click(within(group).getByRole('button', { name: 'Aktionen für Zahnarzt bezahlen' }));
    const items = (await screen.findAllByRole('menuitem')).map((m) => m.textContent);
    // K1b: the source's main action leads (a route to its pay step), then what is left for a thing on no day.
    expect(items).toEqual(['Bezahlt …', 'Öffnen', 'Nicht planen']);
    expect(
      within(group).getByRole('button', { name: 'Bezahlt …: Zahnarzt bezahlen' }),
    ).toBeInTheDocument();
  });

  it('only late invoices: the sheet says where the open things are, not „Noch nichts geplant“', async () => {
    await invoice('Zahnarzt', '2026-11-08');
    draw();
    expect(await screen.findByTestId('planner-empty-day')).toHaveTextContent(
      'Die Woche ist leer. Offen sind nur die Rechnungen unter „Frist vorbei“.',
    );
    expect(screen.queryByTestId('planner-empty')).toBeNull();
  });

  it('⋯ „Verschieben …“ → a day chip: three taps lay the thing on that day – not „fest“, nothing else moves; „Festnageln auf …“ is gone', async () => {
    const task = await taskRepo.create({
      listId: 'inbox',
      title: 'Saugen',
      done: false,
      priority: 0,
      order: 0,
      estimateMin: 30,
    });
    const other = await taskRepo.create({
      listId: 'inbox',
      title: 'Wischen',
      done: false,
      priority: 3,
      order: 0,
      estimateMin: 30,
    });
    await placed(`todos:${task.id}`, '2026-11-16', 0);
    await placed(`todos:${other.id}`, '2026-11-16', 1);
    draw();
    fireEvent.click((await screen.findAllByRole('button', { name: 'Aktionen für Saugen' }))[0]!);
    const menu = (await screen.findAllByRole('menuitem')).map((m) => m.textContent);
    expect(menu.slice(0, 2)).toEqual(['Verschieben …', 'Später']);
    expect(menu.some((m) => /Festnageln/.test(m ?? ''))).toBe(false);
    fireEvent.click(screen.getByRole('menuitem', { name: 'Verschieben …' }));
    const sheet = await screen.findByRole('dialog', { name: 'Verschieben: Saugen' });
    expect(
      within(sheet)
        .getAllByRole('button', { pressed: false })
        .map((b) => b.textContent),
    ).toEqual(['So 15.', 'Di 17.', 'Mi 18.', 'Do 19.', 'Fr 20.', 'Sa 21.']);
    // The day the thing lies on is the chosen chip.
    expect(
      within(sheet)
        .getAllByRole('button', { pressed: true })
        .map((b) => b.textContent),
    ).toEqual(['Mo 16.']);
    fireEvent.click(within(sheet).getByRole('button', { name: 'Mi 18.' }));
    await waitFor(async () =>
      expect((await assignmentRepo.get(`todos:${task.id}#0`))?.date).toBe('2026-11-18'),
    );
    await waitFor(() => expect(useUiStore.getState().toasts.at(-1)?.message).toBe('Liegt auf Mi'));
    // A move is the row's date and nothing else: no pin, no lock, and the other thing stays where it lies.
    expect((await itemRepo.get(`todos:${task.id}`))?.pinned).toBeUndefined();
    expect((await assignmentRepo.get(`todos:${task.id}#0`))?.locked).toBeUndefined();
    expect((await assignmentRepo.get(`todos:${other.id}#0`))?.date).toBe('2026-11-16');
    expect(await assignmentRepo.active().count()).toBe(2);
  });
});

describe('„Warum?“ beside the day’s capacity', () => {
  const DAY: BoardDay = {
    date: '2026-11-16',
    isToday: false,
    availableMin: 240,
    raw: 180,
    usable: 144,
    planned: 60,
    free: 84,
    over: 0,
    off: false,
    defaultMin: 240,
    blockers: [
      { id: 'c', label: 'Teamrunde', min: 60, from: '09:30', to: '10:30', calendar: true },
    ],
    rows: [],
  };
  const draw = (day: BoardDay, dayEnd?: string) =>
    render(
      <DayPage
        day={day}
        tomorrow
        renderRow={() => null}
        onEditDay={() => undefined}
        thenOpen
        onThenToggle={() => undefined}
        empty={<p>leer</p>}
        dayEnd={dayEnd}
      />,
    );

  it('names the day’s time, every blocker with its length, the buffer, the window and the day’s end', () => {
    expect(capacityWhy(DAY)).toBe('4 h für den Tag. Abgezogen: Teamrunde 1 h, Puffer 36 Min.');
    expect(capacityWhy({ ...DAY, window: { from: '09:00', to: '17:00' } }, '21:00')).toBe(
      '4 h für den Tag. Abgezogen: Teamrunde 1 h, Puffer 36 Min. Zeitfenster 09:00–17:00. Tagesende 21:00.',
    );
    expect(capacityWhy({ ...DAY, raw: 240, usable: 240, blockers: [] })).toBe('4 h für den Tag.');
  });

  it('the capacity is the one control: it opens one line and „Zeit ändern“, and closes it again', () => {
    const onEditDay = vi.fn();
    render(
      <DayPage
        day={DAY}
        tomorrow
        renderRow={() => null}
        onEditDay={onEditDay}
        thenOpen
        onThenToggle={() => undefined}
        empty={<p>leer</p>}
        dayEnd="21:00"
      />,
    );
    // No second „Warum?“ control beside the capacity.
    expect(screen.queryByRole('button', { name: 'Warum?' })).toBeNull();
    const why = screen.getByRole('button', { name: '1 h 24 frei von 2 h 24 – warum?' });
    expect(why).toHaveAttribute('aria-expanded', 'false');
    const line = document.getElementById(why.getAttribute('aria-controls')!)!;
    expect(line).not.toBeVisible();
    fireEvent.click(why);
    expect(why).toHaveAttribute('aria-expanded', 'true');
    expect(line).toHaveTextContent(
      '4 h für den Tag. Abgezogen: Teamrunde 1 h, Puffer 36 Min. Tagesende 21:00.',
    );
    fireEvent.click(screen.getByRole('button', { name: 'Zeit für Montag ändern' }));
    expect(onEditDay).toHaveBeenCalledTimes(1);
    fireEvent.click(why);
    expect(line).not.toBeVisible();
  });

  it('a day off has no question to answer: its capacity opens the day’s settings', () => {
    draw({ ...DAY, off: true, availableMin: 0, raw: 0, usable: 0 });
    expect(screen.queryByRole('button', { name: /warum\?/ })).toBeNull();
    expect(screen.getByRole('button', { name: /Zeit für Montag ändern/ })).toBeTruthy();
  });
});

describe('„Nächste Fristen“', () => {
  const entry = (id: string, due?: string): PlannableEntry => ({
    moduleId: 'invoices',
    id,
    kind: 'invoice',
    title: id,
    to: `/x/${id}`,
    ...(due ? { due: { date: due, hard: true } } : {}),
  });
  const row = (id: string, hardDue?: string, extra: Partial<BoardRow> = {}): BoardRow => ({
    unitId: `invoices:${id}#0`,
    itemKey: `invoices:${id}`,
    title: id,
    minutes: 10,
    k: 0,
    of: 1,
    reason: 'new',
    approx: false,
    pinned: false,
    ...(hardDue ? { hardDue } : {}),
    entry: entry(id),
    ...extra,
  });
  const day = (date: string, rows: BoardRow[]): BoardDay => ({
    date,
    isToday: date === '2026-11-15',
    availableMin: 240,
    raw: 240,
    usable: 192,
    planned: 0,
    free: 192,
    over: 0,
    off: false,
    defaultMin: 240,
    blockers: [],
    rows,
  });

  it('the next three hard deadlines inside the days, not late, one row per thing, nearest first', () => {
    const days = [
      day('2026-11-15', []),
      day('2026-11-16', [
        row('soft'),
        row('late', '2026-11-14', { late: true }),
        row('fri', '2026-11-20'),
      ]),
      day('2026-11-17', [row('thu', '2026-11-19', { k: 0, of: 2 })]),
      day('2026-11-18', [row('thu', '2026-11-19', { k: 1, of: 2 }), row('wed', '2026-11-18')]),
      day('2026-11-21', [row('sat', '2026-11-21')]),
    ];
    const waiting: WaitingRow[] = [
      {
        unitId: 'invoices:far#0',
        itemKey: 'invoices:far',
        title: 'far',
        minutes: 10,
        k: 0,
        of: 1,
        reason: 'horizon',
        entry: entry('far', '2026-11-30'),
      },
      {
        unitId: 'invoices:tue#0',
        itemKey: 'invoices:tue',
        title: 'tue',
        minutes: 10,
        k: 0,
        of: 1,
        reason: 'after-hard-due',
        entry: entry('tue', '2026-11-17'),
      },
    ];
    expect(nextDeadlinesOf(days, waiting).map((d) => `${d.title} ${d.date}`)).toEqual([
      'tue 2026-11-17',
      'wed 2026-11-18',
      'thu 2026-11-19',
    ]);
    expect(nextDeadlinesOf(days, [], 9).map((d) => d.title)).toEqual(['wed', 'thu', 'fri', 'sat']);
    expect(nextDeadlinesOf([day('2026-11-15', [row('soft')])], [])).toEqual([]);
  });
});
