// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { t } from '@/strings';
import type * as Vault from '../vault';

/** Offline before first use: the dictionary import fails until the network is back. */
const net = vi.hoisted(() => ({ offline: true, imports: 0 }));
vi.mock('@zxcvbn-ts/language-de', async (importOriginal) => {
  net.imports++;
  if (net.offline) throw new TypeError('Failed to fetch dynamically imported module');
  return importOriginal();
});

/** The vault itself is not under test here (Argon2 at full strength would take seconds). */
const vault = vi.hoisted(() => ({ created: [] as string[] }));
vi.mock('../vault', async (importOriginal) => ({
  ...(await importOriginal<typeof Vault>()),
  createVault: async (password: string) => {
    vault.created.push(password);
  },
}));

afterEach(() => {
  cleanup();
  net.offline = true;
});

// Both cases import large module graphs for the first time (the setup screen, the strength meter); on a busy CI
// machine that takes longer than the defaults (5 s per test, 1 s per `findBy`/`waitFor`).
const SLOW = 40_000;

// Order matters: the module keeps dictionaries once loaded, so the offline-only case runs first.
describe('strength offline before the dictionaries ever loaded', () => {
  it(
    'creating the vault offline: no strength, no advice, and no "damaged" message',
    async () => {
      const { SetupScreen } = await import('../components/SetupScreen');
      render(<SetupScreen />);
      const pw = 'zehn-zeichen-lang';
      fireEvent.change(screen.getByLabelText(t.accounts.setup.password), { target: { value: pw } });
      fireEvent.change(screen.getByLabelText(t.accounts.setup.confirm), { target: { value: pw } });
      fireEvent.click(screen.getByRole('button', { name: t.accounts.setup.create }));
      await waitFor(() => expect(vault.created).toEqual([pw]), { timeout: SLOW / 2 });
      expect(screen.queryByText(t.accounts.lock.corrupt)).toBeNull();
      expect(screen.queryByTestId('weak-password')).toBeNull();
    },
    SLOW,
  );

  it(
    'measuring rejects with StrengthUnavailable, the meter shows a calm note, online it measures',
    async () => {
      const { measureStrength, StrengthUnavailable } = await import('../strength');
      const { StrengthMeter } = await import('../components/StrengthMeter');
      await expect(measureStrength('Tr0ub4dor&3')).rejects.toBeInstanceOf(StrengthUnavailable);

      const onMeasured = vi.fn();
      render(<StrengthMeter password="correct horse battery staple" onMeasured={onMeasured} />);
      const note = await screen.findByTestId('online-chunk', {}, { timeout: SLOW / 2 });
      expect(note.getAttribute('role')).toBe('status');
      expect(note.textContent).toMatch(/Stärke-Anzeige lädt beim ersten Mal aus dem Netz/);
      expect(screen.queryByRole('alert')).toBeNull();
      expect(onMeasured).toHaveBeenLastCalledWith(undefined);

      net.offline = false;
      act(() => {
        window.dispatchEvent(new Event('online'));
      });
      await waitFor(() => expect(screen.getByTestId('strength')).toBeTruthy(), {
        timeout: SLOW / 2,
      });
      expect(screen.queryByTestId('online-chunk')).toBeNull();
      expect(onMeasured).toHaveBeenLastCalledWith(expect.any(Number));
    },
    SLOW,
  );
});
