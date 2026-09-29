import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { setPlatform, type BiometricService, type UnsealResult } from '@/core/platform';
import { createWebPlatform } from '@/core/platform/web';
import {
  biometricStatus,
  disableBiometricUnlock,
  enableBiometricUnlock,
  sealName,
  unlockWithBiometrics,
} from '../biometric';
import { getSession } from '../session';
import {
  createVault,
  decryptAll,
  isReadable,
  lockVault,
  resetAttempts,
  saveEntry,
  VaultError,
} from '../vault';

const FAST = { m: 64, t: 1, p: 1 };
const MASTER = 'Master-Passwort-Nr-1';

/** In-memory stand-in for the OS: what "sealed" looks like, and how the user answers the prompt. */
function fakeBiometrics() {
  const sealed = new Map<string, Uint8Array>();
  const state = {
    available: true,
    answer: 'ok' as 'ok' | 'cancelled' | 'invalidated',
    prompts: 0,
    sealed,
  };
  const service: BiometricService = {
    available: async () => state.available,
    async seal(name, secret) {
      state.prompts++;
      if (state.answer === 'cancelled') return 'cancelled';
      sealed.set(name, new Uint8Array(secret)); // copy: the caller wipes its buffer
      return 'sealed';
    },
    async unseal(name): Promise<UnsealResult> {
      state.prompts++;
      if (!sealed.has(name)) return { status: 'missing' };
      if (state.answer === 'cancelled') return { status: 'cancelled' };
      if (state.answer === 'invalidated') {
        sealed.delete(name);
        return { status: 'invalidated' };
      }
      return { status: 'ok', secret: new Uint8Array(sealed.get(name)!) as Uint8Array<ArrayBuffer> };
    },
    has: async (name) => sealed.has(name),
    remove: async (name) => void sealed.delete(name),
  };
  return { service, state };
}

let bio: ReturnType<typeof fakeBiometrics>;

beforeEach(async () => {
  lockVault();
  resetAttempts();
  await db.table('accounts_vault').clear();
  await db.table('accounts_entry').clear();
  bio = fakeBiometrics();
  setPlatform({ ...createWebPlatform(), biometrics: bio.service });
});
afterEach(() => {
  setPlatform(undefined);
  lockVault();
});

async function setUp() {
  await createVault(MASTER, FAST);
  await saveEntry({ title: 'Bank', password: 'geheim-1' });
  lockVault();
}

const codeOf = async (p: Promise<unknown>) => {
  try {
    await p;
    return 'ok';
  } catch (e) {
    return e instanceof VaultError ? e.code : String(e);
  }
};

describe('biometric unlock', () => {
  it('is unavailable without biometrics (browser) and not enrolled by default', async () => {
    await setUp();
    expect(await biometricStatus()).toEqual({ available: true, enrolled: false });
    bio.state.available = false;
    expect(await biometricStatus()).toEqual({ available: false, enrolled: false });
    expect(await unlockWithBiometrics()).toBe('unavailable');
    setPlatform(undefined); // the real web platform
    expect(await biometricStatus()).toEqual({ available: false, enrolled: false });
  });

  it('enrolling needs the right master password and seals the data key under the vault id', async () => {
    await setUp();
    expect(await codeOf(enableBiometricUnlock('falsch-falsch-1'))).toBe('wrong-password');
    expect(bio.state.sealed.size).toBe(0);
    expect(await enableBiometricUnlock(MASTER)).toBe('enabled');
    expect(bio.state.sealed.size).toBe(1);
    const [name, secret] = [...bio.state.sealed.entries()][0]!;
    expect(name).toMatch(/^vault-dek:/);
    expect(secret).toHaveLength(32); // the raw 256-bit data key, nothing else
    expect(await biometricStatus()).toEqual({ available: true, enrolled: true });
  });

  it('a dismissed enrol prompt enables nothing', async () => {
    await setUp();
    bio.state.answer = 'cancelled';
    expect(await enableBiometricUnlock(MASTER)).toBe('cancelled');
    expect(await biometricStatus()).toEqual({ available: true, enrolled: false });
  });

  it('unlocks the locked vault with the biometric and the entries decrypt', async () => {
    await setUp();
    await enableBiometricUnlock(MASTER);
    expect(getSession().status).toBe('locked');
    expect(await unlockWithBiometrics()).toBe('ok');
    expect(getSession().status).toBe('unlocked');
    const [entry] = await decryptAll();
    expect(isReadable(entry!) && entry.data.password).toBe('geheim-1');
    const s = getSession();
    expect(s.status === 'unlocked' && s.dek.extractable).toBe(false); // back to a non-extractable key
  });

  it('stays locked when the prompt is dismissed', async () => {
    await setUp();
    await enableBiometricUnlock(MASTER);
    bio.state.answer = 'cancelled';
    expect(await unlockWithBiometrics()).toBe('cancelled');
    expect(getSession().status).toBe('locked');
  });

  it('a destroyed key (changed fingerprints) means "invalid" and the seal is dropped', async () => {
    await setUp();
    await enableBiometricUnlock(MASTER);
    bio.state.answer = 'invalidated';
    expect(await unlockWithBiometrics()).toBe('invalid');
    expect(getSession().status).toBe('locked');
    expect(await biometricStatus()).toEqual({ available: true, enrolled: false });
  });

  it('never accepts a key that does not open this vault (stale or foreign) and removes it', async () => {
    await setUp();
    await enableBiometricUnlock(MASTER);
    const [name] = [...bio.state.sealed.keys()];
    bio.state.sealed.set(name!, crypto.getRandomValues(new Uint8Array(32))); // some other key
    expect(await unlockWithBiometrics()).toBe('invalid');
    expect(getSession().status).toBe('locked');
    expect(bio.state.sealed.size).toBe(0);
  });

  it('a seal of another vault is not used: the name carries the vault id', async () => {
    await setUp();
    await enableBiometricUnlock(MASTER);
    // a new vault replaces the header (different id) – the old seal must not apply
    await db.table('accounts_vault').clear();
    await db.table('accounts_entry').clear();
    await createVault('Zweiter-Tresor-Passwort', FAST);
    lockVault();
    expect(await biometricStatus()).toEqual({ available: true, enrolled: false });
    expect(await unlockWithBiometrics()).toBe('invalid'); // nothing sealed for this vault
    expect(sealName('a')).not.toBe(sealName('b'));
  });

  it('disabling removes the seal', async () => {
    await setUp();
    await enableBiometricUnlock(MASTER);
    await disableBiometricUnlock();
    expect(bio.state.sealed.size).toBe(0);
    expect(await biometricStatus()).toEqual({ available: true, enrolled: false });
  });

  it('works for a vault without entries (nothing to verify against)', async () => {
    await createVault(MASTER, FAST);
    lockVault();
    await enableBiometricUnlock(MASTER);
    expect(await unlockWithBiometrics()).toBe('ok');
  });

  it('does not touch the master password rate limit', async () => {
    await setUp();
    await enableBiometricUnlock(MASTER);
    for (let i = 0; i < 5; i++) {
      bio.state.answer = 'cancelled';
      await unlockWithBiometrics();
    }
    bio.state.answer = 'ok';
    expect(await unlockWithBiometrics()).toBe('ok');
  });
});
