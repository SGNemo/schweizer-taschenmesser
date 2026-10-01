// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import { markOnboardingHandled } from '@/core/importer/batches';
import { setPlatform } from '@/core/platform';
import { createWebPlatform } from '@/core/platform/web';
import { allSetupSteps, applicableSteps } from '@/core/setup/registry';
import type { SetupCtx, SetupStepProps } from '@/core/setup/types';
import { loadPrefs } from '@/core/update/prefs';
import { t } from '@/strings';
import AiImportStep, { aiImportModules } from './AiImportStep';
import BackupUpdatesStep from './BackupUpdatesStep';
import NotificationsStep from './NotificationsStep';
import StartDataStep from './StartDataStep';

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

function withPermission(permission: 'granted' | 'default' | 'denied') {
  const web = createWebPlatform();
  const state = { permission };
  setPlatform({
    ...web,
    notifications: {
      ...web.notifications,
      permission: () => state.permission,
      requestPermission: async () => {
        state.permission = 'granted';
        return 'granted';
      },
    },
  });
}

beforeEach(async () => {
  await db.table('_modules').clear();
  await db.table('_meta').clear();
  setPlatform(undefined);
});

describe('step order', () => {
  it('puts the security step before every step that stores secrets', () => {
    const order = new Map(allSetupSteps.map((s) => [s.id, s.order]));
    expect(order.get('accounts.vault')!).toBeLessThan(order.get('core.ai')!);
    expect(order.get('accounts.vault')!).toBeLessThan(order.get('core.connectors')!);
    expect(new Set(order.values()).size).toBe(order.size);
  });

  it('hides the start-data and AI-import steps when no active module offers them', async () => {
    const steps = await applicableSteps(allSetupSteps, { ...ctx, modules: {} });
    const ids = steps.map((s) => s.id);
    expect(ids).not.toContain('core.startdata');
    expect(ids).not.toContain('core.aiimport');
    const some = await applicableSteps(allSetupSteps, { ...ctx, modules: { todos: true } });
    expect(some.map((s) => s.id)).toEqual(
      expect.arrayContaining(['core.startdata', 'core.aiimport']),
    );
  });
});

describe('start data step', () => {
  it('lists active modules with start data and marks handled ones', async () => {
    await markOnboardingHandled('todos');
    render(<StartDataStep {...harness().props} />);
    // todos and calendar are on by default; a switched-off module does not appear.
    expect(await screen.findByText('ToDos')).toBeInTheDocument();
    expect(await screen.findByText(t.setup.steps.startdata.handled)).toBeInTheDocument();
    expect(screen.queryByText('Notizen')).toBeNull();
  });
});

describe('AI import step', () => {
  it('never offers the vault or disabled modules', () => {
    const ids = aiImportModules({ accounts: true, todos: true, notes: false }).map((m) => m.id);
    expect(ids).toContain('todos');
    expect(ids).not.toContain('accounts');
    expect(ids).not.toContain('notes');
  });

  it('copies only the schema text', async () => {
    const writeText = vi.fn(async () => {});
    const web = createWebPlatform();
    setPlatform({ ...web, clipboard: { ...web.clipboard, writeText } });
    const user = userEvent.setup();
    render(<AiImportStep {...harness().props} />);
    await user.click((await screen.findAllByRole('button', { name: t.dataApi.copySchema }))[0]!);
    expect(writeText).toHaveBeenCalledTimes(1);
  });
});

describe('notifications step', () => {
  it('is recorded as skipped while the permission is not granted', async () => {
    withPermission('denied');
    const h = harness();
    render(<NotificationsStep {...h.props} />);
    expect(await screen.findByText(t.setup.steps.notifications.state.denied!)).toBeInTheDocument();
    expect(await h.run()).toBe('skipped');
  });

  it('asks on click and is done once granted', async () => {
    withPermission('default');
    const h = harness();
    const user = userEvent.setup();
    render(<NotificationsStep {...h.props} />);
    expect(await h.run()).toBe('skipped'); // "Weiter" without deciding
    await user.click(screen.getByRole('button', { name: t.setup.steps.notifications.allow }));
    expect(await screen.findByText(t.setup.steps.notifications.state.granted!)).toBeInTheDocument();
    expect(await h.run()).toBeUndefined();
  });
});

describe('backup and updates step', () => {
  it('writes the update preferences only on commit', async () => {
    setPlatform({ ...createWebPlatform(), isNative: true });
    const h = harness();
    const user = userEvent.setup();
    render(<BackupUpdatesStep {...h.props} />);
    await user.selectOptions(
      await screen.findByLabelText(t.setup.steps.backupupdates.channel),
      'beta',
    );
    expect((await loadPrefs()).channel).toBe('stable');
    await h.run();
    expect((await loadPrefs()).channel).toBe('beta');
  });
});
