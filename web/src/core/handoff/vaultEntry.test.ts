// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setNow } from '@/core/time/now';
import { clearVaultEntry, HANDOFF_TTL_MS, offerVaultEntry, peekVaultEntry } from './vaultEntry';

const entry = {
  title: 'Persona',
  username: 'anna.test42',
  password: 'pw-for-this-test',
  notes: 'Berlin',
};
let t0 = 1_000_000;

beforeEach(() => {
  t0 = 1_000_000;
  setNow(() => t0);
  clearVaultEntry();
});
afterEach(() => {
  setNow();
  vi.restoreAllMocks();
});

describe('vault entry handoff', () => {
  it('holds one entry and can be read more than once until it is cleared', () => {
    expect(peekVaultEntry()).toBeUndefined();
    offerVaultEntry(entry);
    expect(peekVaultEntry()).toEqual(entry);
    expect(peekVaultEntry()).toEqual(entry);
    clearVaultEntry();
    expect(peekVaultEntry()).toBeUndefined();
  });

  it('hands out copies, so a caller cannot change what is waiting', () => {
    offerVaultEntry(entry);
    const a = peekVaultEntry()!;
    a.password = 'changed';
    expect(peekVaultEntry()!.password).toBe(entry.password);
  });

  it('a second offer replaces the first', () => {
    offerVaultEntry(entry);
    offerVaultEntry({ ...entry, title: 'Second' });
    expect(peekVaultEntry()!.title).toBe('Second');
  });

  it('expires after five minutes', () => {
    offerVaultEntry(entry);
    t0 += HANDOFF_TTL_MS - 1;
    expect(peekVaultEntry()).toEqual(entry);
    t0 += 1;
    expect(peekVaultEntry()).toBeUndefined();
  });

  it('is never written to any storage', () => {
    const local = vi.spyOn(Storage.prototype, 'setItem');
    const open = vi.spyOn(indexedDB, 'open');
    offerVaultEntry(entry);
    peekVaultEntry();
    clearVaultEntry();
    expect(local).not.toHaveBeenCalled();
    expect(open).not.toHaveBeenCalled();
  });
});
