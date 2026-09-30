import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { prepareCreate } from '@/core/ai/query/create';
import { clearAll, ctxFor } from '@/core/ai/testing';
import { db } from '@/core/db/db';
import { setNow } from '@/core/time/now';
import { reminderRepo } from '@/modules/reminders/repo';
import { reminderSchema } from '@/modules/reminders/schema';
import { taskRepo } from '@/modules/todos/repo';
import { taskSchema } from '@/modules/todos/schema';
import { t } from '@/strings';
import { useUiStore } from '@/stores/ui';
import { AnswerView } from './assistant/AnswerView';
import { CommandPalette, filterCommands, normalize } from './CommandPalette';

function Where() {
  return <p data-testid="where">{useLocation().pathname}</p>;
}

beforeEach(() => useUiStore.setState({ paletteOpen: true }));

describe('command palette', () => {
  it('normalizes diacritics and case', () => {
    expect(normalize('  Übersicht ')).toBe('ubersicht');
  });

  it('filters commands', () => {
    const cmds = [
      { id: 'a', label: 'Einstellungen', icon: 'settings' as const, run: () => undefined },
      { id: 'b', label: 'Kalender', icon: 'calendar' as const, run: () => undefined },
    ];
    expect(filterCommands(cmds, 'kal').map((c) => c.id)).toEqual(['b']);
    expect(filterCommands(cmds, '')).toHaveLength(2);
  });

  it('navigates with the keyboard and closes', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Where />
        <CommandPalette />
      </MemoryRouter>,
    );
    await user.type(await screen.findByRole('combobox'), 'einst{Enter}');
    expect(screen.getByTestId('where')).toHaveTextContent('/settings');
    expect(useUiStore.getState().paletteOpen).toBe(false);
  });

  it('offers the assistant when nothing matches', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <CommandPalette />
      </MemoryRouter>,
    );
    await user.type(await screen.findByRole('combobox'), 'zzzzz');
    expect(screen.getAllByRole('option')).toHaveLength(1);
    expect(screen.getByRole('option')).toHaveTextContent(`${t.ai.palette.ask}: „zzzzz“`);
  });

  it('calculates arithmetic on the spot, before the assistant, without leaving the palette', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <CommandPalette />
      </MemoryRouter>,
    );
    await user.type(await screen.findByRole('combobox'), '240 + 19%');
    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveTextContent('240 + 19% = 285,6');
    expect(options[1]).toHaveTextContent(t.ai.palette.ask);
    await user.type(screen.getByRole('combobox'), '{Enter}');
    expect(useUiStore.getState().paletteOpen).toBe(true); // copying does not close it
  });

  it('does not treat a plain number as a calculation', async () => {
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <CommandPalette />
      </MemoryRouter>,
    );
    await user.type(await screen.findByRole('combobox'), '2026');
    expect(screen.queryByRole('option', { name: /=/ })).toBeNull();
  });

  it('lists the navigation commands for an empty query', async () => {
    render(
      <MemoryRouter>
        <CommandPalette />
      </MemoryRouter>,
    );
    // Navigation commands (dashboard, library, settings) are always there.
    expect((await screen.findAllByRole('option')).length).toBeGreaterThanOrEqual(3);
  });
});

describe('assistant in the palette', () => {
  beforeEach(async () => {
    setNow(() => new Date(2026, 8, 29, 10, 0).getTime());
    await clearAll();
  });
  afterEach(() => setNow());

  it('answers a stage-1 question locally and shows the tier', async () => {
    await taskRepo.create(
      taskSchema.parse({ listId: 'inbox', title: 'Milch kaufen', dueDate: '2026-09-29' }),
    );
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <CommandPalette />
      </MemoryRouter>,
    );
    await user.type(await screen.findByRole('combobox'), 'Was steht heute an?{Enter}');
    expect(await screen.findByText('Milch kaufen')).toBeInTheDocument();
    expect(screen.getByTestId('ai-tier')).toHaveTextContent('Lokal · 0 Token');

    await user.click(screen.getByRole('button', { name: t.ai.palette.back }));
    expect(await screen.findByRole('combobox')).toBeInTheDocument();
  });

  it('lists live full text hits and opens the module', async () => {
    await reminderRepo.create(
      reminderSchema.parse({ title: 'Miete überweisen', startDate: '2026-10-01' }),
    );
    const user = userEvent.setup();
    render(
      <MemoryRouter>
        <Where />
        <CommandPalette />
      </MemoryRouter>,
    );
    await user.type(await screen.findByRole('combobox'), 'miete');
    const hit = await screen.findByRole('option', { name: /Miete überweisen/ });
    await user.click(hit);
    expect(screen.getByTestId('where')).toHaveTextContent('/reminders');
  });

  it('confirms before creating an entry', async () => {
    const prepared = await prepareCreate(
      { module: 'todos', collection: 'task', data: { title: 'Brot kaufen' } },
      ctxFor(),
    );
    render(
      <MemoryRouter>
        <AnswerView
          response={{
            ok: true,
            tier: 'model',
            result: { kind: 'create', prepared },
            usage: { inputTokens: 420, outputTokens: 30, model: 'm' },
          }}
          onDone={() => undefined}
        />
      </MemoryRouter>,
    );
    expect(screen.getByTestId('ai-tier')).toHaveTextContent('KI · 420 + 30 Token');
    expect(await db.table('todos_task').count()).toBe(0); // nothing saved yet
    await userEvent.setup().click(screen.getByRole('button', { name: t.ai.create.confirm }));
    await waitFor(async () => expect(await db.table('todos_task').count()).toBe(1));
  });

  it('shows friendly errors', () => {
    render(
      <MemoryRouter>
        <AnswerView response={{ ok: false, error: 'auth' }} onDone={() => undefined} />
      </MemoryRouter>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent(t.ai.errors.auth!);
  });
});
