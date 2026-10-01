// @vitest-environment jsdom
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { setPlatform, type BiometricService, type UnsealResult } from '@/core/platform';
import { createWebPlatform } from '@/core/platform/web';
import { t } from '@/strings';
import { enableBiometricUnlock, biometricStatus } from '../biometric';
import { LockScreen } from '../components/LockScreen';
import { ToolsDialog } from '../components/ToolsDialog';
import { getSession } from '../session';
import { createVault, lockVault, resetAttempts } from '../vault';

const FAST = { m: 64, t: 1, p: 1 };
const MASTER = 'Master-Passwort-Nr-1';
const b = t.accounts.biometric;

function fake(answer: 'ok' | 'cancelled' = 'ok', available = true) {
  const sealed = new Map<string, Uint8Array>();
  const state = { answer, available, sealed };
  const service: BiometricService = {
    available: async () => state.available,
    async seal(name, secret) {
      sealed.set(name, new Uint8Array(secret));
      return 'sealed';
    },
    async unseal(name): Promise<UnsealResult> {
      if (!sealed.has(name)) return { status: 'missing' };
      if (state.answer === 'cancelled') return { status: 'cancelled' };
      return { status: 'ok', secret: new Uint8Array(sealed.get(name)!) as Uint8Array<ArrayBuffer> };
    },
    has: async (n) => sealed.has(n),
    remove: async (n) => void sealed.delete(n),
  };
  return { service, state };
}

let bio: ReturnType<typeof fake>;
beforeEach(async () => {
  lockVault();
  resetAttempts();
  await db.table('accounts_vault').clear();
  await db.table('accounts_entry').clear();
  bio = fake();
  setPlatform({ ...createWebPlatform(), biometrics: bio.service });
});
afterEach(() => {
  setPlatform(undefined);
  lockVault();
});

describe('lock screen with biometrics', () => {
  it('offers the prompt once on its own and unlocks', async () => {
    await createVault(MASTER, FAST);
    await enableBiometricUnlock(MASTER);
    lockVault();
    render(<LockScreen />);
    await waitFor(() => expect(getSession().status).toBe('unlocked'));
  });

  it('after a dismissed prompt the password field stays and a button retries', async () => {
    await createVault(MASTER, FAST);
    await enableBiometricUnlock(MASTER);
    lockVault();
    bio.state.answer = 'cancelled';
    render(<LockScreen />);
    const retry = await screen.findByRole('button', { name: b.unlock });
    expect(getSession().status).toBe('locked');
    bio.state.answer = 'ok';
    await userEvent.setup().click(retry);
    await waitFor(() => expect(getSession().status).toBe('unlocked'));
  });

  it('shows no biometric button when nothing is enrolled or the device has none', async () => {
    await createVault(MASTER, FAST);
    lockVault();
    const { unmount } = render(<LockScreen />);
    await screen.findByLabelText(t.accounts.lock.password);
    expect(screen.queryByRole('button', { name: b.unlock })).toBeNull();
    unmount();
    bio.state.available = false;
    render(<LockScreen />);
    await screen.findByLabelText(t.accounts.lock.password);
    expect(screen.queryByRole('button', { name: b.unlock })).toBeNull();
  });

  it('explains an invalid seal and falls back to the master password', async () => {
    await createVault(MASTER, FAST);
    await enableBiometricUnlock(MASTER);
    lockVault();
    bio.state.sealed.set([...bio.state.sealed.keys()][0]!, new Uint8Array(32)); // wrong key
    render(<LockScreen />);
    expect(await screen.findByText(b.invalid)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: b.unlock })).toBeNull(); // seal was removed
    expect(getSession().status).toBe('locked');
  });
});

describe('tools dialog: biometric section', () => {
  it('enabling asks for the master password; a wrong one enables nothing', async () => {
    await createVault(MASTER, FAST);
    render(<ToolsDialog open onClose={() => undefined} entries={[]} />);
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText(b.enterPassword), 'falsch-falsch-1');
    await user.click(screen.getByRole('button', { name: b.enable }));
    expect(await screen.findByText(t.accounts.lock.wrong)).toBeInTheDocument();
    expect(await biometricStatus()).toMatchObject({ enrolled: false });

    await user.clear(screen.getByLabelText(b.enterPassword));
    await user.type(screen.getByLabelText(b.enterPassword), MASTER);
    await user.click(screen.getByRole('button', { name: b.enable }));
    expect(await screen.findByRole('button', { name: b.disable })).toBeInTheDocument();
    expect(await biometricStatus()).toMatchObject({ enrolled: true });

    await user.click(screen.getByRole('button', { name: b.disable }));
    await waitFor(async () => expect(await biometricStatus()).toMatchObject({ enrolled: false }));
  });

  it('says the feature needs the installed app when the device has no biometrics', async () => {
    await createVault(MASTER, FAST);
    bio.state.available = false;
    render(<ToolsDialog open onClose={() => undefined} entries={[]} />);
    expect(await screen.findByText(b.unavailable)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: b.enable })).toBeNull();
  });
});
