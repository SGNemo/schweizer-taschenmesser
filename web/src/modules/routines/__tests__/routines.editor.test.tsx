// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import { getPlatform } from '@/core/platform';
import { today } from '@/core/time/dates';
import { RoutineEditor, type RoutineTarget } from '../components/RoutineEditor';
import { RoutineRun } from '../components/RoutineRun';
import { newRoutine } from '../logic';
import { routineRepo } from '../repo';

const editor = (target: RoutineTarget, onClose = vi.fn()) =>
  render(
    <MemoryRouter>
      <RoutineEditor target={target} rooms={[]} onClose={onClose} />
    </MemoryRouter>,
  );

describe('routine editor: one way to set a routine up', () => {
  beforeEach(async () => {
    await db.table('routines_routine').clear();
  });

  it('a start fills name, rhythm, time of day and steps; „Routine eintragen“ keeps them', async () => {
    const user = userEvent.setup();
    const onClose = vi.fn();
    editor({ draft: true }, onClose);
    await user.click(await screen.findByRole('button', { name: 'Morgen' }));
    expect(screen.getByRole('button', { name: 'Morgen' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByLabelText('Name')).toHaveValue('Morgenroutine');
    expect(screen.getByLabelText('Wie oft')).toHaveValue('daily');
    expect(screen.getByLabelText('Tageszeit')).toHaveValue('morning');
    expect((screen.getByLabelText(/Schritte/) as HTMLTextAreaElement).value).toContain(
      'Zähne putzen',
    );
    await user.click(screen.getByRole('button', { name: 'Routine eintragen' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    const [r] = await routineRepo.active().toArray();
    expect(r).toMatchObject({ name: 'Morgenroutine', daypart: 'morning', dueDate: today() });
    expect(r!.repeat).toMatchObject({ freq: 'daily', interval: 1 });
    expect(r!.steps).toHaveLength(6);
    // The planner is off here: its switch was not shown, so nothing is stored for it.
    expect(screen.queryByRole('checkbox', { name: 'Im Planer zeigen' })).toBeNull();
    expect(r!.planner).toBeUndefined();
  });

  it('a name typed by hand stays when a start is picked; „Leer“ clears the steps', async () => {
    const user = userEvent.setup();
    editor({ draft: true });
    await user.type(await screen.findByLabelText('Name'), 'Mein Abend');
    await user.click(screen.getByRole('button', { name: 'Abend' }));
    expect(screen.getByLabelText('Name')).toHaveValue('Mein Abend');
    expect(screen.getByLabelText('Tageszeit')).toHaveValue('evening');
    await user.click(screen.getByRole('button', { name: 'Leer' }));
    expect(screen.getByLabelText(/Schritte/)).toHaveValue('');
    expect(screen.getByLabelText('Name')).toHaveValue('Mein Abend');
  });

  it('„An bestimmten Tagen“ shows the days; the last chosen day cannot be taken away', async () => {
    const user = userEvent.setup();
    editor({ draft: true, start: 'weekClean' });
    expect(await screen.findByLabelText('Wie oft')).toHaveValue('weekdays');
    const sat = screen.getByRole('button', { name: 'Sa' });
    expect(sat).toHaveAttribute('aria-pressed', 'true');
    // The last day stays chosen, stays reachable and says why.
    expect(sat).toHaveAttribute('aria-disabled', 'true');
    expect(sat).toHaveAccessibleDescription('Ein Tag bleibt immer gewählt.');
    await user.click(sat);
    expect(sat).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Mo' }));
    expect(sat).not.toHaveAttribute('aria-disabled');
  });

  it('„Anders“ opens the full rule', async () => {
    const user = userEvent.setup();
    editor({ draft: true });
    await user.selectOptions(await screen.findByLabelText('Wie oft'), 'custom');
    expect(screen.getByLabelText('Wiederholung')).toBeInTheDocument();
  });
});

describe('Durchführen: step by step', () => {
  it('a turn ticked elsewhere meanwhile: a late tick is not written into the new turn', async () => {
    const user = userEvent.setup();
    const day = today();
    const r = await routineRepo.create({
      name: 'Abendroutine',
      repeat: { freq: 'daily', interval: 1 },
      startDate: day,
      dueDate: day,
      people: [],
      turn: 0,
      steps: [
        { id: 'a', text: 'Tasche packen' },
        { id: 'b', text: 'Zähne putzen' },
      ],
    });
    render(
      <MemoryRouter>
        <RoutineRun id={r.id} onClose={vi.fn()} onEdit={vi.fn()} />
      </MemoryRouter>,
    );
    const box = await screen.findByRole('checkbox', { name: 'Tasche packen' });
    // Done on another device: the row moves on before the tick lands.
    const getSpy = vi.spyOn(routineRepo, 'get').mockResolvedValueOnce({
      ...(await routineRepo.get(r.id))!,
      dueDate: '2099-01-01',
    });
    await user.click(box);
    await waitFor(() => expect(getSpy).toHaveBeenCalled());
    getSpy.mockRestore();
    expect((await routineRepo.get(r.id))?.progress).toBeUndefined();
  });

  beforeEach(async () => {
    await db.table('routines_routine').clear();
  });

  it('every tick is kept; the last one is „Erledigt“ for the whole routine', async () => {
    const user = userEvent.setup();
    const day = today();
    const r = await routineRepo.create({
      name: 'Abendroutine',
      repeat: { freq: 'daily', interval: 1 },
      startDate: day,
      dueDate: day,
      people: [],
      turn: 0,
      steps: [
        { id: 'a', text: 'Tasche packen' },
        { id: 'b', text: 'Zähne putzen' },
      ],
    });
    const onClose = vi.fn();
    render(
      <MemoryRouter>
        <RoutineRun id={r.id} onClose={onClose} onEdit={vi.fn()} />
      </MemoryRouter>,
    );
    expect(await screen.findByText('0 von 2 Schritten')).toBeInTheDocument();
    await user.click(screen.getByRole('checkbox', { name: 'Tasche packen' }));
    expect(await screen.findByText('1 von 2 Schritten')).toBeInTheDocument();
    expect((await routineRepo.get(r.id))?.progress).toEqual({ day, done: ['a'] });
    await user.click(screen.getByRole('checkbox', { name: 'Zähne putzen' }));
    await waitFor(async () => expect((await routineRepo.get(r.id))?.dueDate).not.toBe(day));
    expect(onClose).toHaveBeenCalled();
    expect((await routineRepo.get(r.id))?.lastDoneOn).toBe(day);
  });
});

describe('routine editor: a reminder without the system permission', () => {
  beforeEach(async () => {
    await db.table('routines_routine').clear();
  });
  afterEach(() => vi.restoreAllMocks());

  it('a time set while notifications are not allowed shows one calm line; „Erlauben“ only while it can be asked', async () => {
    const perm = vi.spyOn(getPlatform().notifications, 'permission').mockReturnValue('default');
    const user = userEvent.setup();
    const { unmount } = editor({ draft: true });
    await screen.findByLabelText('Name');
    expect(screen.queryByTestId('remind-permission-hint')).toBeNull();
    await user.type(screen.getByLabelText(/Erinnerung/), '0730');
    expect((await screen.findByTestId('remind-permission-hint')).textContent).toMatch(
      /noch nicht erlaubt/,
    );
    expect(screen.getByRole('button', { name: 'Erlauben' })).toBeTruthy();
    unmount();
    perm.mockReturnValue('denied');
    const stored = await routineRepo.create({
      ...newRoutine({
        name: 'Pflanzen gießen',
        room: '',
        repeat: { freq: 'weekly', interval: 1 },
        people: '',
        dueDate: today(),
        note: '',
      }),
      remindAt: '08:00',
    });
    editor(stored);
    expect((await screen.findByTestId('remind-permission-hint')).textContent).toMatch(/blockiert/);
    expect(screen.queryByRole('button', { name: 'Erlauben' })).toBeNull();
  });
});
