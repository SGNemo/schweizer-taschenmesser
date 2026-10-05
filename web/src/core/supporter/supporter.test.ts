// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { encodeCode, generateKeyPair } from '@nemo/supporter-codes';
import { db } from '@/core/db/db';
import { settingsRepo } from '@/core/settings/settings';
import { decryptOps, deriveKey, encryptOps, newSalt } from '@/core/sync/crypto';
import { mergeOps, recordToOps, type SyncRow } from '@/core/sync/ops';
import { SUPPORTER_PUBLIC_KEYS } from './publicKeys';
import { SUPPORTER_SCOPE } from './settings';
// Public TEST key pair of packages/supporter-codes (never accepted by a normal build).
import {
  TEST_KEY_ID,
  TEST_PUBLIC_KEY,
  TEST_SECRET_KEY,
} from '../../../../packages/supporter-codes/test/fixtures/test-keypair';
import { E2E_TEST_KEY_ID, E2E_TEST_PUBLIC_KEY } from './keys';

const toHex = (b: Uint8Array) => Array.from(b, (x) => x.toString(16).padStart(2, '0')).join('');
const signed = (tier: 'kaffee' | 'kuchen' | 'developer', name = '') =>
  encodeCode({ keyId: E2E_TEST_KEY_ID, tier, issued: '2026-10-05', name }, TEST_SECRET_KEY);

/** The E2E build trusts the test key (id 255); load the module graph fresh with that env. */
async function withTestKey() {
  vi.resetModules();
  vi.stubEnv('VITE_INCLUDE_EXAMPLE', 'true');
  return import('./index');
}

beforeEach(async () => {
  vi.unstubAllEnvs();
  await db.table('_settings').clear();
});

describe('embedded keys', () => {
  it('the public test key is the E2E key only – never part of the app keys', () => {
    expect(E2E_TEST_PUBLIC_KEY).toBe(toHex(TEST_PUBLIC_KEY));
    expect(Object.values(SUPPORTER_PUBLIC_KEYS)).not.toContain(E2E_TEST_PUBLIC_KEY);
    expect(TEST_KEY_ID).not.toBe(E2E_TEST_KEY_ID); // fixture id is only used inside the package tests
  });

  it('a normal build rejects codes signed with the test key, and any code while no key is set', async () => {
    vi.resetModules();
    const { acceptCode } = await import('./index');
    expect(acceptCode(signed('developer'))).toBeNull();
    const foreign = encodeCode(
      { keyId: 1, tier: 'kaffee', issued: '2026-10-05' },
      generateKeyPair().secretKey,
    );
    expect(acceptCode(foreign)).toBeNull();
  });
});

describe('status', () => {
  it('derives tier, name and date from the code and falls back to none', async () => {
    const m = await withTestKey();
    const code = signed('kuchen', 'Ada');
    expect(m.deriveStatus(code)).toMatchObject({
      tier: 'kuchen',
      name: 'Ada',
      issued: '2026-10-05',
      source: 'code',
    });
    expect(m.deriveStatus('')).toEqual(m.NO_SUPPORTER);
    expect(m.deriveStatus('NEMO1-garbage')).toMatchObject({ tier: 'none', unrecognised: true });
  });

  it('the dev override wins over the code and "none" simulates a non-supporter', async () => {
    const m = await withTestKey();
    const code = signed('kaffee');
    expect(m.deriveStatus(code, 'developer')).toMatchObject({ tier: 'developer', source: 'dev' });
    expect(m.deriveStatus(code, 'none')).toEqual(m.NO_SUPPORTER);
  });

  it('enter stores the canonical code, remove clears it, bad input stores nothing', async () => {
    const m = await withTestKey();
    expect(await m.enterCode('NEMO1-nope')).toBe(false);
    expect(await settingsRepo.get(SUPPORTER_SCOPE)).toBeUndefined();

    const code = signed('kaffee', 'Sven');
    expect(await m.enterCode(' ' + code.toLowerCase().replace(/-/g, ' ') + ' ')).toBe(true);
    const row = await settingsRepo.get(SUPPORTER_SCOPE);
    expect(row).toMatchObject({ code, addedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/) });

    await m.removeCode();
    expect(await settingsRepo.get(SUPPORTER_SCOPE)).toMatchObject({ code: '', addedAt: '' });
  });
});

describe('sync round trip', () => {
  it('the code travels encrypted and device B derives the same status from it', async () => {
    const m = await withTestKey();
    const code = signed('kuchen', 'Ada');
    await m.enterCode(code);
    const row = (await settingsRepo.get(SUPPORTER_SCOPE)) as unknown as SyncRow;

    const key = await deriveKey('test passphrase', newSalt(), 1000);
    const wire = await encryptOps(key, recordToOps('_settings', row));
    expect(JSON.stringify(wire)).not.toContain(code.slice(6, 30)); // ciphertext only

    const { ops, rejected } = await decryptOps(key, wire);
    expect(rejected).toBe(0);
    const { row: remote } = mergeOps(undefined, row.id, ops);
    expect(m.deriveStatus(String(remote.code))).toMatchObject({ tier: 'kuchen', name: 'Ada' });
  });

  it('a synced tier field cannot grant anything: only the verified code counts', async () => {
    const m = await withTestKey();
    const { row } = mergeOps(undefined, 'supporter', [
      {
        collection: '_settings',
        id: 'supporter',
        field: 'tier',
        hlc: '1700000000000-0000-aaaa0001',
        value: 'developer',
      },
      {
        collection: '_settings',
        id: 'supporter',
        field: 'code',
        hlc: '1700000000000-0000-aaaa0001',
        value: 'NEMO1-fake',
      },
    ]);
    expect(m.deriveStatus(String(row.code)).tier).toBe('none');
  });
});

describe('offline guarantee', () => {
  it('verifying and entering a code makes no network call', async () => {
    const m = await withTestKey();
    const calls: string[] = [];
    vi.stubGlobal('fetch', (...a: unknown[]) => calls.push(`fetch ${String(a[0])}`));
    const open = vi.spyOn(XMLHttpRequest.prototype, 'open').mockImplementation((...a) => {
      calls.push(`xhr ${String(a[1])}`);
    });
    const beacon = vi.fn(() => true);
    vi.stubGlobal('navigator', { ...navigator, sendBeacon: beacon });

    await m.enterCode(signed('kaffee'));
    m.deriveStatus(signed('kuchen'));
    await m.removeCode();

    expect(calls).toEqual([]);
    expect(beacon).not.toHaveBeenCalled();
    open.mockRestore();
    vi.unstubAllGlobals();
  });
});
