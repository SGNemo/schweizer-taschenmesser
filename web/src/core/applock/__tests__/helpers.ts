/** Test helpers for the app lock: in-memory secrets and biometrics (never imported by app code). */
import type { BiometricService, UnsealResult } from '@/core/platform';
import type { SecretStore } from '@/core/secrets/types';

export function memorySecrets(): SecretStore & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    protection: 'device-key',
    get: async (name) => map.get(name),
    has: async (name) => (map.get(name) ?? '') !== '',
    set: async (name, value) => void map.set(name, value),
    delete: async (name) => void map.delete(name),
  };
}

export function fakeBiometrics() {
  const sealed = new Map<string, Uint8Array>();
  const state = {
    available: true,
    answer: 'ok' as 'ok' | 'cancelled' | 'invalidated',
    sealed,
  };
  const service: BiometricService = {
    available: async () => state.available,
    async seal(name, secret) {
      if (state.answer === 'cancelled') return 'cancelled';
      sealed.set(name, new Uint8Array(secret));
      return 'sealed';
    },
    async unseal(name): Promise<UnsealResult> {
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

/** Tiny Argon2 parameters: allowed in unit tests only (`core/crypto/kdf.ts`). */
export const FAST_KDF = { m: 64, t: 1, p: 1 };
