// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import { loadModuleStates } from '@/core/modules/activation';
import { visibleManifests } from '@/core/modules/registry';
import { CORE_SCOPE, coreSettingsSchema, DEFAULT_CORE } from '@/core/settings/core';
import { getSettings, setSettings } from '@/core/settings/settings';
import { tableName } from '@/core/db/schema';
import { disableModule } from '@/core/modules/activation';
import type { SetupCtx, SetupStepProps } from '@/core/setup/types';
import { useUiStore } from '@/stores/ui';
import { t } from '@/strings';
import BasicsStep from './BasicsStep';
import ProfilesStep from './ProfilesStep';
import ToolsStep from './ToolsStep';

const todos = visibleManifests.find((m) => m.id === 'todos')!;
const todoTable = tableName('todos', Object.keys(todos.dataSchema.collections)[0]!);
const ctx: SetupCtx = { modules: {}, platform: 'web', isNative: false };

function harness() {
  let commit: (() => Promise<void | 'skipped'>) | null = null;
  const canContinue = vi.fn();
  const props: SetupStepProps = {
    ctx,
    registerCommit: (fn) => {
      commit = fn;
    },
    setCanContinue: canContinue,
  };
  return { props, run: async () => commit?.(), hasCommit: () => commit !== null, canContinue };
}

beforeEach(async () => {
  await db.table('_modules').clear();
  await db.table('_settings').clear();
  useUiStore.getState().setTheme('system');
});

describe('basics step', () => {
  it('keeps the draft local until it is committed', async () => {
    const h = harness();
    const user = userEvent.setup();
    render(<BasicsStep {...h.props} />);
    await user.type(await screen.findByLabelText(t.setup.steps.basics.name), 'Erika');
    await user.selectOptions(screen.getByLabelText(t.setup.steps.basics.weekStart), 'sun');
    await user.selectOptions(screen.getByLabelText(t.settings.theme), 'dark');
    // Nothing written yet (cancelling here would lose exactly this draft).
    expect(await getSettings(CORE_SCOPE, coreSettingsSchema, DEFAULT_CORE)).toEqual(DEFAULT_CORE);
    expect(useUiStore.getState().theme).toBe('system');
    await h.run();
    expect(await getSettings(CORE_SCOPE, coreSettingsSchema, DEFAULT_CORE)).toMatchObject({
      displayName: 'Erika',
      weekStart: 'sun',
    });
    expect(useUiStore.getState().theme).toBe('dark');
  });

  it('shows the current values of an existing installation', async () => {
    await setSettings(CORE_SCOPE, { displayName: 'Max', weekStart: 'sun' });
    render(<BasicsStep {...harness().props} />);
    expect(await screen.findByLabelText(t.setup.steps.basics.name)).toHaveValue('Max');
    expect(screen.getByLabelText(t.setup.steps.basics.weekStart)).toHaveValue('sun');
  });
});

describe('profiles step', () => {
  const s = t.setup.steps.profiles;

  it('changes nothing on an existing installation until a profile is picked', async () => {
    const h = harness();
    render(<ProfilesStep {...h.props} />);
    expect(await screen.findByText(s.diffNone)).toBeInTheDocument();
    expect(h.hasCommit()).toBe(false);
    const before = await loadModuleStates();
    await h.run();
    expect(await loadModuleStates()).toEqual(before);
  });

  it('shows the diff, blocks "Weiter" until confirmed, then applies it and keeps the data', async () => {
    const h = harness();
    const user = userEvent.setup();
    // A todo the user already has must survive the profile switch.
    await db.table(todoTable).put({ id: 't1', title: 'Erfunden' });
    render(<ProfilesStep {...h.props} />);
    await user.click(await screen.findByTestId('profile-minimal'));
    const diff = await screen.findByTestId('profile-diff');
    expect(diff).toHaveTextContent(/Wird deaktiviert/);
    await waitFor(() => expect(h.canContinue).toHaveBeenLastCalledWith(false));
    await user.click(screen.getByLabelText(s.confirm));
    await waitFor(() => expect(h.canContinue).toHaveBeenLastCalledWith(true));
    await h.run();
    const states = await loadModuleStates();
    const active = visibleManifests.filter((m) => states[m.id]).map((m) => m.id);
    expect(active.sort()).toEqual(['calendar', 'todos']);
    expect(await db.table(todoTable).get('t1')).toBeDefined();
    await db.table(todoTable).delete('t1');
  });

  it('adds what a module builds on when it is switched on', async () => {
    const h = harness();
    const user = userEvent.setup();
    // Finance is on by default; switch it off so the dependency has to be pulled in again.
    await disableModule(
      visibleManifests.find((m) => m.id === 'finance')!,
      'keep',
    );
    render(<ProfilesStep {...h.props} />);
    const budgets = visibleManifests.find((m) => m.id === 'budgets')!;
    await user.click(await screen.findByRole('switch', { name: new RegExp(budgets.name) }));
    expect(await screen.findByTestId('profile-diff')).toHaveTextContent(/Finanzen/);
  });
});

describe('tools step', () => {
  it('writes the draft on commit only', async () => {
    const h = harness();
    const user = userEvent.setup();
    render(<ToolsStep {...h.props} />);
    const first = (await screen.findAllByRole('switch'))[1]!; // [0] is the developer toggle
    const was = first.getAttribute('aria-checked') === 'true';
    await user.click(first);
    expect(await db.table('_settings').get('tools')).toBeUndefined();
    await h.run();
    const row = await db.table('_settings').get('tools');
    expect(Object.values(row?.enabled ?? {})).toContain(!was);
  });
});
