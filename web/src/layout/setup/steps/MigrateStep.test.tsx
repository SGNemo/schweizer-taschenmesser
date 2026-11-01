// @vitest-environment jsdom
import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import { useOnboardingHost } from '@/core/importer/host';
import { loadModuleStates } from '@/core/modules/activation';
import { readMigrateState } from '@/core/setup/migrate';
import type { SetupCtx, SetupStepProps } from '@/core/setup/types';
import { t } from '@/strings';
import MigrateStep from './MigrateStep';

const s = t.setup.steps.migrate;
const ctx: SetupCtx = { modules: {}, platform: 'web', isNative: false };

function harness() {
  let commit: (() => Promise<void | 'skipped'>) | null = null;
  const props: SetupStepProps = {
    ctx,
    registerCommit: (fn) => {
      commit = fn;
    },
    setCanContinue: vi.fn(),
  };
  return { props, run: async () => commit?.(), hasCommit: () => commit !== null };
}

const view = (props: SetupStepProps) =>
  render(
    <MemoryRouter>
      <MigrateStep {...props} />
    </MemoryRouter>,
  );

beforeEach(async () => {
  await db.table('_meta').clear();
  await db.table('_modules').clear();
  await db.table('_imports').clear();
  useOnboardingHost.setState({ moduleId: null });
});

describe('migrate step', () => {
  it('shows a tile per origin with where to get the export, and "Papier" opens nothing', async () => {
    view(harness().props);
    for (const key of ['google', 'todoist', 'obsidian', 'bank', 'bitwarden', 'paper'])
      expect(
        await screen.findByRole('region', { name: s.origins[key]!.title }),
      ).toBeInTheDocument();
    expect(screen.getByText(s.origins.google!.how)).toBeInTheDocument();
    expect(screen.getByText(s.origins.paper!.how)).toBeInTheDocument();
  });

  it('without a choice there is nothing to write ("Später")', async () => {
    const h = harness();
    view(h.props);
    await screen.findByRole('region', { name: s.origins.paper!.title });
    expect(h.hasCommit()).toBe(false);
  });

  it('opens the existing importer of the module (switching it on) and remembers only the origin', async () => {
    const user = userEvent.setup();
    const h = harness();
    view(h.props);
    const google = await screen.findByRole('region', { name: s.origins.google!.title });
    await user.click(within(google).getByRole('button', { name: s.actions.notes! }));
    await waitFor(() => expect(useOnboardingHost.getState().moduleId).toBe('notes'));
    expect((await loadModuleStates()).notes).toBe(true);
    const state = await readMigrateState();
    expect(Object.keys(state.origins)).toEqual(['google']);
    // Chosen but no import ran yet: "Weiter" records "Später".
    await waitFor(() => expect(h.hasCommit()).toBe(true));
    expect(await h.run()).toBe('skipped');
  });

  it('"Papier" counts as an answer', async () => {
    const user = userEvent.setup();
    const h = harness();
    view(h.props);
    await user.click(await screen.findByRole('button', { name: s.origins.paper!.title }));
    await waitFor(() => expect(h.hasCommit()).toBe(true));
    expect(await h.run()).toBeUndefined();
    expect(useOnboardingHost.getState().moduleId).toBeNull();
  });
});
