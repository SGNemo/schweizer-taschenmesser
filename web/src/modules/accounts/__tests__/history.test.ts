import { beforeEach, describe, expect, it } from 'vitest';
import type { KeychainHeader } from '@/core/crypto';
import {
  HISTORY_SIZE,
  clearGeneratedHistory,
  recordGenerated,
  useGeneratedHistory,
} from '../history';
import { setSession } from '../session';

const items = () => useGeneratedHistory.getState().items;

beforeEach(() => {
  setSession({ status: 'locked' });
  clearGeneratedHistory();
});

describe('generated password history', () => {
  it('keeps the newest five, newest first', () => {
    for (let i = 1; i <= 7; i++) recordGenerated(`pw-${i}`);
    expect(items()).toEqual(['pw-7', 'pw-6', 'pw-5', 'pw-4', 'pw-3']);
    expect(items()).toHaveLength(HISTORY_SIZE);
  });
  it('moves a repeated value to the front instead of duplicating it', () => {
    recordGenerated('a');
    recordGenerated('b');
    recordGenerated('a');
    expect(items()).toEqual(['a', 'b']);
  });
  it('ignores empty values', () => {
    recordGenerated('');
    expect(items()).toEqual([]);
  });
  it('is dropped when the vault locks', () => {
    setSession({
      status: 'unlocked',
      vaultId: 'v',
      header: {} as KeychainHeader,
      dek: {} as CryptoKey,
    });
    recordGenerated('secret');
    expect(items()).toEqual(['secret']);
    setSession({ status: 'locked' });
    expect(items()).toEqual([]);
  });
});
