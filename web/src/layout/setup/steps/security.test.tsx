/**
 * Security properties of the setup assistant: no half-created vault when cancelling, secrets only
 * in the crypto service / secret store, never in the setup state, the outbox or the console.
 */
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { loadAiConfig, keyName } from '@/core/ai/config';
import { db } from '@/core/db/db';
import { setPlatform, type PlatformService } from '@/core/platform';
import { createWebPlatform } from '@/core/platform/web';
import { getSettings } from '@/core/settings/settings';
import { readSetupState, markStepDone, SETUP_STATE_KEY } from '@/core/setup/state';
import type { SetupCtx, SetupStepProps } from '@/core/setup/types';
import { readHeader, lockVault, resetAttempts } from '@/modules/accounts/vault';
import { settingsSchema, defaultSettings } from '@/modules/accounts/settings';
import VaultSetupStep from '@/modules/accounts/components/VaultSetupStep';
import { t } from '@/strings';
import AiStep from './AiStep';

const ctx: SetupCtx = { modules: { accounts: true }, platform: 'web', isNative: false };
// Invented values only (public repo).
const MASTER = 'Erfundenes-Master-Passwort-1'; // gitleaks:allow
const API_KEY = 'sk-erfunden-0000000000000000'; // gitleaks:allow

const stored = new Map<string, string>();
function installPlatform() {
  const web = createWebPlatform();
  setPlatform({
    ...web,
    secrets: {
      protection: 'device-key',
      get: async (n) => stored.get(n),
      set: async (n, v) => void stored.set(n, v),
      delete: async (n) => void stored.delete(n),
    },
    // No local Ollama in tests.
    fetch: (async () => Promise.reject(new Error('offline'))) as typeof fetch,
  } satisfies PlatformService);
}

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
  return { props, run: async () => commit?.(), canContinue, hasCommit: () => commit !== null };
}

beforeEach(async () => {
  stored.clear();
  installPlatform();
  for (const n of ['_meta', '_secrets', '_outbox', '_settings', 'accounts_vault', 'accounts_entry'])
    await db.table(n).clear();
  lockVault();
  resetAttempts();
});
afterEach(() => setPlatform(undefined));

describe('vault step', () => {
  it('creates nothing while the password is too short or not repeated, and cancelling leaves no vault', async () => {
    const h = harness();
    const user = userEvent.setup();
    const { unmount } = render(<VaultSetupStep {...h.props} />);
    await user.type(await screen.findByLabelText(t.accounts.setup.password), 'kurz');
    await waitFor(() => expect(h.canContinue).toHaveBeenLastCalledWith(false));
    expect(h.hasCommit()).toBe(false);
    await user.type(screen.getByLabelText(t.accounts.setup.confirm), MASTER);
    await user.clear(screen.getByLabelText(t.accounts.setup.password));
    await user.type(screen.getByLabelText(t.accounts.setup.password), MASTER.slice(0, -1)); // mismatch
    await waitFor(() => expect(h.canContinue).toHaveBeenLastCalledWith(false));
    unmount(); // = cancelling the assistant here
    expect((await readHeader()).state).toBe('none');
  });

  it('creates the vault only on commit with a confirmed strong password, and stores nothing of it', async () => {
    const h = harness();
    const user = userEvent.setup();
    render(<VaultSetupStep {...h.props} />);
    await user.type(await screen.findByLabelText(t.accounts.setup.password), MASTER);
    await user.type(screen.getByLabelText(t.accounts.setup.confirm), MASTER);
    await waitFor(() => expect(h.canContinue).toHaveBeenLastCalledWith(true));
    expect((await readHeader()).state).toBe('none'); // still nothing before "Weiter"
    await h.run();
    expect((await readHeader()).state).toBe('ready');
    await markStepDone('accounts.vault');
    const everything = JSON.stringify([
      await readSetupState(),
      await db.table('_meta').toArray(),
      await db.table('_outbox').toArray(),
    ]);
    expect(everything).not.toContain(MASTER);
  });

  it('keeps an existing vault untouched and only offers the lock settings', async () => {
    const first = harness();
    const user = userEvent.setup();
    const view = render(<VaultSetupStep {...first.props} />);
    await user.type(await screen.findByLabelText(t.accounts.setup.password), MASTER);
    await user.type(screen.getByLabelText(t.accounts.setup.confirm), MASTER);
    await first.run();
    view.unmount();
    const before = JSON.stringify(await db.table('accounts_vault').toArray());

    const h = harness();
    render(<VaultSetupStep {...h.props} />);
    expect(await screen.findByText(t.accounts.setupStep.hasVault)).toBeInTheDocument();
    expect(screen.queryByLabelText(t.accounts.setup.password)).toBeNull();
    await user.selectOptions(screen.getByLabelText(t.accounts.setupStep.autoLock), '15');
    await h.run();
    expect(JSON.stringify(await db.table('accounts_vault').toArray())).toBe(before);
    expect(await getSettings('module.accounts', settingsSchema, defaultSettings)).toMatchObject({
      autoLockMinutes: '15',
    });
  });
});

describe('AI step', () => {
  async function addAnthropic(h: ReturnType<typeof harness>) {
    const user = userEvent.setup();
    render(<AiStep {...h.props} />);
    await user.selectOptions(await screen.findByLabelText(t.setup.steps.ai.add), 'anthropic');
    await user.type(await screen.findByLabelText(t.setup.steps.ai.key), API_KEY);
    return user;
  }

  it('writes nothing until "Weiter": cancelling leaves no provider and no key', async () => {
    const h = harness();
    await addAnthropic(h);
    expect(stored.size).toBe(0);
    expect((await loadAiConfig()).providers).toEqual([]);
  });

  it('puts the key into the secret store only, never into config, setup state, outbox or logs', async () => {
    const logs: string[] = [];
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((m) =>
      vi.spyOn(console, m).mockImplementation((...a) => void logs.push(a.join(' '))),
    );
    const h = harness();
    await addAnthropic(h);
    await h.run();
    await markStepDone('core.ai');
    expect(stored.get(keyName('anthropic'))).toBe(API_KEY);
    const config = await loadAiConfig();
    expect(config.providers.map((p) => [p.id, p.keySet])).toEqual([['anthropic', true]]);
    const dump = JSON.stringify([
      config,
      await readSetupState(),
      await db.table('_meta').toArray(),
      await db.table('_outbox').toArray(),
      await db.table('_settings').toArray(),
      logs,
    ]);
    expect(dump).not.toContain(API_KEY);
    spies.forEach((s) => s.mockRestore());
  });

  it('a failed connection test shows only the mapped reason, not the raw response', async () => {
    const h = harness();
    const user = await addAnthropic(h);
    setPlatform({
      ...createWebPlatform(),
      fetch: (async () =>
        new Response(JSON.stringify({ error: { message: `bad key ${API_KEY}` } }), {
          status: 401,
        })) as typeof fetch,
    });
    await user.click(screen.getByRole('button', { name: t.setup.steps.ai.test }));
    const result = await screen.findByTestId('ai-test-anthropic');
    expect(result.textContent).not.toContain(API_KEY);
  });

  it('the setup state never holds anything but step ids', async () => {
    await markStepDone('core.ai');
    const row = await db.table('_meta').get(SETUP_STATE_KEY);
    expect(Object.keys(row.value).sort()).toEqual([
      'checklistHidden',
      'doneSteps',
      'lastStep',
      'skippedSteps',
      'status',
      'version',
    ]);
  });
});
