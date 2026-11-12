// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { patchFocusSettings } from '@/core/settings/focus';
import { setNow } from '@/core/time/now';
import { TodayCard, todayFigure } from '../components/TodayCard';
import TodosPage from '../routes/TodosPage';
import { listRepo, taskRepo } from '../repo';

const NOW = new Date(2026, 10, 3, 10, 0).getTime(); // 2026-11-03
const base = { listId: 'inbox', done: false, priority: 0, order: 0 };

const draw = (url = '/todos') =>
  render(
    <MemoryRouter initialEntries={[url]}>
      <TodosPage />
    </MemoryRouter>,
  );

beforeEach(async () => {
  setNow(() => NOW);
  await db.table('todos_task').clear();
  await db.table('todos_list').clear();
  await db.table('_settings').clear();
  await db.table('_meta').clear();
  await listRepo.create({ name: 'Eingang', order: 0 }, { id: 'inbox' });
});
afterEach(() => {
  cleanup();
  setNow();
});

async function seedThree() {
  await taskRepo.create({ ...base, title: 'Heute fällig', dueDate: '2026-11-03' });
  await taskRepo.create({ ...base, title: 'Nächste Woche', dueDate: '2026-11-10' });
  await taskRepo.create({ ...base, title: 'Ohne Datum' });
}

describe('ToDos views', () => {
  it('shows one task per view by its dates', async () => {
    await seedThree();
    const { unmount } = draw('/todos?view=today');
    // The title stands in the list and in the page's first row ("Als Nächstes").
    expect((await screen.findAllByText('Heute fällig'))[0]).toBeVisible();
    expect(screen.queryByText('Nächste Woche')).toBeNull();
    expect(screen.queryByText('Ohne Datum')).toBeNull();
    unmount();
    draw('/todos?view=soon');
    expect(await screen.findByText('Nächste Woche')).toBeVisible();
    // Only the first row ("Als Nächstes") still names it, no row of the list.
    expect(screen.queryAllByText('Heute fällig').filter((el) => el.closest('li'))).toEqual([]);
  });

  it('keeps a task with a later start date out of the plain list and the Heute view', async () => {
    await taskRepo.create({
      ...base,
      title: 'Noch nicht dran',
      dueDate: '2026-11-03',
      startDate: '2026-11-08',
    });
    const { unmount } = draw('/todos');
    await waitFor(() => expect(screen.queryByText('Noch nicht dran')).toBeNull());
    unmount();
    draw('/todos?view=soon');
    expect(await screen.findByText('Noch nicht dran')).toBeVisible();
    expect(screen.getByText(/ab /)).toBeVisible();
  });

  it('filters by tag', async () => {
    await taskRepo.create({ ...base, title: 'Rasen mähen', tags: ['garten'] });
    await taskRepo.create({ ...base, title: 'Steuer', tags: ['papier'] });
    draw('/todos?tag=garten');
    expect(await screen.findByText('Rasen mähen')).toBeVisible();
    expect(screen.queryByText('Steuer')).toBeNull();
    await userEvent.click(screen.getByRole('button', { name: 'Alle Tags' }));
    expect(await screen.findByText('Steuer')).toBeVisible();
    expect(screen.getByText('Rasen mähen')).toBeVisible();
  });

  it('shows the progress of a project list', async () => {
    const project = await listRepo.create({ name: 'Umzug', order: 1, kind: 'project' });
    await taskRepo.create({ ...base, listId: project.id, title: 'Kartons', done: true });
    await taskRepo.create({ ...base, listId: project.id, title: 'Möbel' });
    draw(`/todos?list=${project.id}`);
    expect(await screen.findByText('1 von 2 erledigt')).toBeVisible();
    expect(screen.getByRole('progressbar', { name: 'Umzug' })).toHaveAttribute(
      'aria-valuenow',
      '1',
    );
  });

  it('moves every overdue task to today in one step', async () => {
    // The calm default offers "Neu planen"; the plain wording has the one-step button.
    await patchFocusSettings({ calmAttention: false });
    await taskRepo.create({ ...base, title: 'Alt eins', dueDate: '2026-10-20' });
    await taskRepo.create({ ...base, title: 'Alt zwei', dueDate: '2026-10-25' });
    draw('/todos');
    await userEvent.click(await screen.findByTestId('all-today'));
    await waitFor(async () => {
      const due = (await taskRepo.active().toArray()).map((x) => x.dueDate);
      expect(due).toEqual(['2026-11-03', '2026-11-03']);
    });
  });
});

describe('ToDos board', () => {
  it('has four columns and moves a card from its menu', async () => {
    await taskRepo.create({ ...base, title: 'Ohne Datum' });
    draw('/todos?view=board');
    await screen.findByText('Ohne Datum');
    const someday = screen.getByRole('region', { name: 'Irgendwann' });
    expect(within(someday).getByText('Ohne Datum')).toBeVisible();
    for (const name of ['Heute', 'Demnächst', 'Irgendwann', 'Erledigt'])
      expect(screen.getByRole('region', { name })).toBeVisible();
    await userEvent.click(within(someday).getByRole('button', { name: 'Weitere Optionen' }));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Verschieben nach Heute' }));
    await waitFor(async () =>
      expect((await taskRepo.active().toArray())[0]?.plannedFor).toBe('2026-11-03'),
    );
    const today = screen.getByRole('region', { name: 'Heute' });
    await waitFor(() => expect(within(today).getByText('Ohne Datum')).toBeVisible());
  });

  it('ticks a card off when it goes to Erledigt', async () => {
    const task = await taskRepo.create({ ...base, title: 'Fertig machen', dueDate: '2026-11-03' });
    draw('/todos?view=board');
    await screen.findAllByText('Fertig machen');
    const today = screen.getByRole('region', { name: 'Heute' });
    await userEvent.click(within(today).getByRole('button', { name: 'Weitere Optionen' }));
    await userEvent.click(
      await screen.findByRole('menuitem', { name: 'Verschieben nach Erledigt' }),
    );
    await waitFor(async () => expect((await taskRepo.get(task.id))?.done).toBe(true));
  });
});

describe('ToDos board wording (U48)', () => {
  it('names a passed due date as passed and gives the card button a verb', async () => {
    await taskRepo.create({ ...base, title: 'Recherche', dueDate: '2026-11-01' });
    draw('/todos?view=board');
    const card = (await screen.findAllByText('Recherche'))
      .map((el) => el.closest('li'))
      .find((li) => li !== null)!;
    expect(card).toHaveTextContent('war am So., 1. Nov. fällig');
    expect(within(card).getByRole('button', { name: 'Auf morgen' })).toBeVisible();
  });

  it('keeps a coming due date as a plain date', async () => {
    await taskRepo.create({ ...base, title: 'Bald', dueDate: '2026-11-10' });
    draw('/todos?view=board');
    const card = (await screen.findByText('Bald')).closest('li')!;
    expect(card).toHaveTextContent('Di., 10. Nov.');
    expect(card).not.toHaveTextContent('war am');
  });
});

describe('ToDos empty page (U26)', () => {
  it('offers one next step that opens the add dialog; the page has no add field of its own', async () => {
    draw('/todos');
    const empty = await screen.findByTestId('todos-empty');
    expect(empty).toHaveTextContent('Nichts zu tun – gut so.');
    expect(within(empty).getAllByRole('button')).toHaveLength(1);
    expect(screen.queryByRole('textbox')).toBeNull();
    await userEvent.click(within(empty).getByRole('button', { name: 'Aufgabe eintragen' }));
    const dialog = await screen.findByRole('dialog', { name: 'Neue Aufgabe' });
    await userEvent.type(
      within(dialog).getByRole('textbox', { name: 'Titel' }),
      'Erste Sache{Enter}',
    );
    await waitFor(async () =>
      expect((await taskRepo.active().toArray()).map((x) => x.title)).toEqual(['Erste Sache']),
    );
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
  });
});

describe('ToDos add dialog from a link (`?new=1&title=…`)', () => {
  it('opens with the shared title, saves it once and does not open again', async () => {
    draw('/todos?new=1&title=Blumen%20gie%C3%9Fen');
    const dialog = await screen.findByRole('dialog', { name: 'Neue Aufgabe' });
    const field = within(dialog).getByRole('textbox', { name: 'Titel' });
    expect(field).toHaveValue('Blumen gießen');
    const save = within(dialog).getByRole('button', { name: 'Hinzufügen' });
    await waitFor(() => expect(save).toBeEnabled());
    await userEvent.click(save);
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect((await taskRepo.active().toArray()).map((x) => x.title)).toEqual(['Blumen gießen']);
    // The link's parameters are gone with the dialog: nothing reopens, nothing is added twice.
    await screen.findAllByText('Blumen gießen');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(await taskRepo.active().count()).toBe(1);
  });

  it('"Abbrechen" is the explicit way out: the dialog closes without a question and nothing is saved', async () => {
    draw('/todos?new=1&title=Nicht%20verlieren');
    const dialog = await screen.findByRole('dialog', { name: 'Neue Aufgabe' });
    await userEvent.click(within(dialog).getByRole('button', { name: 'Abbrechen' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.queryByRole('alertdialog')).toBeNull();
    expect(await taskRepo.active().count()).toBe(0);
  });

  it('Escape asks before a shared title is dropped, and "Weiter bearbeiten" keeps it', async () => {
    draw('/todos?new=1&title=Nicht%20verlieren');
    const dialog = await screen.findByRole('dialog', { name: 'Neue Aufgabe' });
    const field = within(dialog).getByRole('textbox', { name: 'Titel' });
    expect(field).toHaveValue('Nicht verlieren');
    // Esc reaches the dialog as the native `cancel` event (jsdom does not raise it by itself).
    fireEvent(document.querySelector('dialog')!, new Event('cancel', { cancelable: true }));
    const question = await screen.findByRole('alertdialog');
    await userEvent.click(within(question).getByRole('button', { name: 'Weiter bearbeiten' }));
    expect(within(dialog).getByRole('textbox', { name: 'Titel' })).toHaveValue('Nicht verlieren');
    expect(await taskRepo.active().count()).toBe(0);
  });

  it('waits for the inbox: without a list the button is disabled, then it saves', async () => {
    await db.table('todos_list').clear();
    draw('/todos?new=1&title=Erste');
    const dialog = await screen.findByRole('dialog', { name: 'Neue Aufgabe' });
    // The page creates the inbox right after it has read the (empty) lists; then saving is possible.
    const save = within(dialog).getByRole('button', { name: 'Hinzufügen' });
    await waitFor(() => expect(save).toBeEnabled());
    await userEvent.click(save);
    await waitFor(async () =>
      expect((await taskRepo.active().toArray()).map((x) => x.title)).toEqual(['Erste']),
    );
  });

  it('an empty view keeps the head figure and the next task of today; only an empty day stays silent', async () => {
    await taskRepo.create({ ...base, title: 'Heute fällig', dueDate: '2026-11-03' });
    const first = draw('/todos?view=someday');
    await screen.findByTestId('todos-empty');
    expect(screen.getByTestId('today-card')).toHaveTextContent('Heute fällig');
    first.unmount();
    await db.table('todos_task').clear();
    draw('/todos');
    await screen.findByTestId('todos-empty');
    expect(screen.getByTestId('today-card')).not.toHaveTextContent(
      'Für heute ist nichts eingetragen.',
    );
  });
});

describe('ToDos board drag and drop', () => {
  it('drops a card onto another column', async () => {
    const task = await taskRepo.create({ ...base, title: 'Ziehkarte' });
    draw('/todos?view=board');
    const card = (await screen.findByText('Ziehkarte')).closest('li')!;
    const data = new Map<string, string>();
    const dataTransfer = {
      setData: (k: string, v: string) => data.set(k, v),
      getData: (k: string) => data.get(k) ?? '',
      effectAllowed: '',
    };
    fireEvent.dragStart(card, { dataTransfer });
    const column = screen.getByRole('region', { name: 'Heute' });
    fireEvent.dragOver(column, { dataTransfer });
    fireEvent.drop(column, { dataTransfer });
    await waitFor(async () => expect((await taskRepo.get(task.id))?.plannedFor).toBe('2026-11-03'));
  });
});

describe('Heute card', () => {
  const task = (over: Record<string, unknown>) =>
    ({ id: 'x', createdAt: 1, ...base, title: 'T', ...over }) as never;

  it('counts what is on today, sums the estimate and names the next task', () => {
    render(
      <TodayCard
        day="2026-11-03"
        tasks={[
          task({ id: 'a', title: 'Anruf', dueDate: '2026-11-03', estimateMin: 15 }),
          task({ id: 'b', title: 'Bericht', plannedFor: '2026-11-03', estimateMin: 30 }),
          task({ id: 'c', title: 'Später', dueDate: '2026-11-20' }),
        ]}
      />,
    );
    // The count and the summed estimate are the head's figure (drawn by the frame); the row names the next task.
    expect(screen.getByTestId('today-card')).toHaveTextContent('2 Aufgaben');
    expect(screen.getByText(/Als Nächstes: /)).toBeVisible();
    const figure = todayFigure(
      [
        task({ id: 'a', dueDate: '2026-11-03', estimateMin: 15 }),
        task({ id: 'b', plannedFor: '2026-11-03', estimateMin: 30 }),
        task({ id: 'c', dueDate: '2026-11-20', estimateMin: 99 }),
      ],
      '2026-11-03',
    );
    expect([figure.today.length, figure.minutes]).toEqual([2, 45]);
  });

  it('with the planner on counts what the plan counts: a later plan day beats an older due date (N02)', () => {
    const tasks = [
      task({ id: 'a', title: 'Heute geplant', plannedFor: '2026-11-03', estimateMin: 5 }),
      task({
        id: 'b',
        title: 'Vom Planer verschoben',
        dueDate: '2026-10-20',
        estimateMin: 60,
        plannedFor: '2026-11-05',
        planMark: { date: '2026-11-05', order: 0 },
      }),
    ];
    const { unmount } = render(<TodayCard day="2026-11-03" tasks={tasks} />);
    expect(screen.getByTestId('today-card')).toHaveTextContent('2 Aufgaben');
    expect(todayFigure(tasks, '2026-11-03').minutes).toBe(65);
    unmount();
    render(<TodayCard day="2026-11-03" tasks={tasks} planner />);
    expect(screen.getByTestId('today-card')).toHaveTextContent('1 Aufgabe');
    const plan = todayFigure(tasks, '2026-11-03', true);
    expect([plan.today.length, plan.minutes]).toEqual([1, 5]);
  });

  it('says so calmly when nothing is left for today', () => {
    const doneToday = new Date(2026, 10, 3, 9, 30).getTime();
    render(
      <TodayCard
        day="2026-11-03"
        tasks={[
          task({ dueDate: '2026-11-20' }),
          task({ id: 'd', dueDate: '2026-11-03', done: true, completedAt: doneToday }),
        ]}
      />,
    );
    expect(screen.getByText('Alles für heute erledigt.')).toBeVisible();
  });

  it('A07: never says "erledigt" when nothing was there for today', () => {
    render(<TodayCard day="2026-11-03" tasks={[task({ dueDate: '2026-11-20' })]} />);
    expect(screen.queryByText('Alles für heute erledigt.')).toBeNull();
    expect(screen.getByText('Für heute ist nichts eingetragen.')).toBeVisible();
  });
});

describe('with the planner module on', () => {
  beforeEach(async () => {
    await db.table('_modules').delete('planner');
  });
  const plannerOn = () =>
    db.table('_modules').put({
      id: 'planner',
      enabled: true,
      dataPolicy: null,
      createdAt: 1,
      updatedAt: 1,
      deviceId: 't',
      deletedAt: null,
      _f: {},
    });

  it('hides „Neu planen“ (the planner distributes the open things)', async () => {
    await taskRepo.create({ ...base, title: 'Alte Sache', dueDate: '2026-10-20' });
    const { unmount } = draw('/todos');
    expect(await screen.findByTestId('todos-waiting')).toBeInTheDocument();
    unmount();
    await plannerOn();
    draw('/todos');
    await screen.findAllByText('Alte Sache');
    await waitFor(() => expect(screen.queryByTestId('todos-waiting')).toBeNull());
    expect(screen.queryByRole('button', { name: 'Neu planen' })).toBeNull();
  });

  it('hides „Alle auf heute“ and leaves a thing the planner put later out of Heute (N02)', async () => {
    await taskRepo.create({ ...base, title: 'Alte Sache', dueDate: '2026-10-20' });
    await taskRepo.create({
      ...base,
      title: 'Vom Planer später',
      dueDate: '2026-10-21',
      plannedFor: '2026-11-05',
      planMark: { date: '2026-11-05', order: 0 },
    });
    await patchFocusSettings({ calmAttention: false });
    const first = draw('/todos');
    await waitFor(() => expect(screen.getByTestId('all-today')).toBeInTheDocument());
    first.unmount();
    const before = draw('/todos?view=today');
    await screen.findAllByText('Vom Planer später');
    before.unmount();
    await plannerOn();
    const all = draw('/todos');
    await screen.findAllByText('Alte Sache');
    await waitFor(() => expect(screen.queryByTestId('all-today')).toBeNull());
    all.unmount();
    draw('/todos?view=today');
    await screen.findAllByText('Alte Sache');
    await waitFor(() => expect(screen.queryByText('Vom Planer später')).toBeNull());
  });

  it('shows „im Plan: <Tag>“ in Bald for a planner-set date, never for the user’s own', async () => {
    await plannerOn();
    await taskRepo.create({
      ...base,
      title: 'Vom Planer',
      plannedFor: '2026-11-05',
      planMark: { date: '2026-11-05', order: 0 },
    });
    await taskRepo.create({ ...base, title: 'Selbst gesetzt', plannedFor: '2026-11-06' });
    draw('/todos?view=soon');
    await screen.findByText('Vom Planer');
    const labels = await screen.findAllByTestId('in-plan');
    expect(labels).toHaveLength(1);
    expect(labels[0]).toHaveTextContent('im Plan: Do');
  });
});
