/**
 * Native secret handling on top of the local `secure-store` plugin (see `src-tauri/plugins/secure-store`):
 * an OS keystore for API keys, a biometric gate for the vault key and screenshot protection.
 * If the plugin reports no keystore (or fails), everything falls back to the WebCrypto device-key store
 * and the biometric gate is reported as unavailable.
 */
import { invoke } from '@tauri-apps/api/core';
import { createDeviceKeyStore } from '@/core/secrets/deviceKey';
import { createMigratingStore } from '@/core/secrets/migrating';
import type { SecretStore } from '@/core/secrets/types';
import { fromBase64, toBase64 } from '@/core/sync/crypto';
import type { BiometricService, PlatformKind, ScreenService, UnsealResult } from '../types';

interface Availability {
  keystore: boolean;
  biometric: boolean;
}

const call = <T>(command: string, request?: Record<string, unknown>) =>
  invoke<T>(`plugin:secure-store|${command}`, request ? { request } : undefined);

export function createNativeStore(): SecretStore {
  return {
    protection: 'os-keystore',
    async get(name) {
      const res = await call<{ value?: string | null }>('get', { name });
      return res.value ?? undefined;
    },
    async set(name, value) {
      await call('set', { name, value });
    },
    async delete(name) {
      await call('delete', { name });
    },
  };
}

export function createNativeBiometrics(available: boolean): BiometricService {
  return {
    available: async () => available,
    async seal(name, secret, prompt) {
      try {
        await call('biometric_seal', { name, secret: toBase64(secret), ...prompt });
        return 'sealed';
      } catch (e) {
        if (String(e) === 'cancelled') return 'cancelled';
        throw e;
      }
    },
    async unseal(name, prompt): Promise<UnsealResult> {
      const res = await call<{ status: string; secret?: string | null }>('biometric_unseal', {
        name,
        ...prompt,
      });
      if (res.status === 'ok' && res.secret)
        return { status: 'ok', secret: fromBase64(res.secret) };
      if (res.status === 'cancelled' || res.status === 'missing' || res.status === 'invalidated') {
        return { status: res.status };
      }
      throw new Error(`unexpected biometric answer: ${res.status}`);
    },
    async has(name) {
      return (await call<{ present: boolean }>('biometric_has', { name })).present;
    },
    async remove(name) {
      await call('biometric_delete', { name });
    },
  };
}

export function createScreenService(kind: PlatformKind): ScreenService {
  return {
    async setSecure(enabled) {
      if (kind !== 'android') return; // FLAG_SECURE exists on Android only
      try {
        await call('set_secure_window', { enabled });
      } catch (e) {
        console.warn('[platform] could not change screenshot protection', e);
      }
    },
  };
}

/** Probes the plugin once at startup. */
export async function createSecureParts(kind: PlatformKind): Promise<{
  secrets: SecretStore;
  biometrics: BiometricService;
  screen: ScreenService;
}> {
  let availability: Availability = { keystore: false, biometric: false };
  try {
    availability = await call<Availability>('available');
  } catch (e) {
    console.warn('[platform] secure-store plugin unavailable, using the local device-key store', e);
  }
  const legacy = createDeviceKeyStore();
  return {
    secrets: availability.keystore ? createMigratingStore(createNativeStore(), legacy) : legacy,
    biometrics: createNativeBiometrics(availability.biometric),
    screen: createScreenService(kind),
  };
}
