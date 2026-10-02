// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { KeychainHeader } from '@/core/crypto';
import { setPlatform } from '@/core/platform';
import { createWebPlatform } from '@/core/platform/web';
import startAccountsService, { openVaultSearch } from '../service';
import { setSession } from '../session';

beforeEach(() => {
  setSession({ status: 'locked' });
  history.replaceState(null, '', '/');
});
afterEach(() => setPlatform(undefined));

describe('vault search key', () => {
  it('does nothing while the vault is locked', () => {
    const pop = vi.fn();
    window.addEventListener('popstate', pop);
    openVaultSearch();
    window.removeEventListener('popstate', pop);
    expect(location.pathname).toBe('/');
    expect(pop).not.toHaveBeenCalled();
  });

  it('opens the vault search when unlocked, every time', () => {
    setSession({
      status: 'unlocked',
      vaultId: 'v',
      header: {} as KeychainHeader,
      dek: {} as CryptoKey,
    });
    openVaultSearch();
    const first = location.search;
    expect(location.pathname).toBe('/accounts');
    expect(first).toMatch(/^\?find=\d+$/);
    openVaultSearch();
    expect(location.search).not.toBe(first); // a new value, so the page focuses again
  });

  it('listens to the shell event only while the service runs', () => {
    const base = createWebPlatform();
    let handler: (() => void) | undefined;
    const off = vi.fn(() => (handler = undefined));
    setPlatform({
      ...base,
      desktop: {
        ...base.desktop,
        onVaultSearch: (cb) => {
          handler = cb;
          return off;
        },
      },
    });
    const stop = startAccountsService();
    expect(handler).toBeDefined();
    stop();
    expect(off).toHaveBeenCalled();
    expect(handler).toBeUndefined();
  });
});
