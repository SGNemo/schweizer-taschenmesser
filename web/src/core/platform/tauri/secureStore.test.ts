import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  invoke: vi.fn(async (_cmd: string, _args?: unknown): Promise<unknown> => undefined),
}));
vi.mock('@tauri-apps/api/core', () => ({ invoke: mocks.invoke }));

import { toBase64 } from '@/core/sync/crypto';
import {
  createNativeBiometrics,
  createNativeStore,
  createScreenService,
  createSecureParts,
} from './secureStore';

const P = 'plugin:secure-store|';
const prompt = { title: 'T', subtitle: 'S', cancel: 'C' };

beforeEach(() => {
  mocks.invoke.mockReset();
});

describe('native secret store', () => {
  it('maps get/set/delete onto the plugin commands', async () => {
    const store = createNativeStore();
    expect(store.protection).toBe('os-keystore');
    mocks.invoke.mockResolvedValueOnce({ value: 'gsk-1' });
    expect(await store.get('ai-key:groq')).toBe('gsk-1');
    expect(mocks.invoke).toHaveBeenLastCalledWith(`${P}get`, { request: { name: 'ai-key:groq' } });
    mocks.invoke.mockResolvedValueOnce({ value: null });
    expect(await store.get('none')).toBeUndefined();
    await store.set('a', 'b');
    expect(mocks.invoke).toHaveBeenLastCalledWith(`${P}set`, {
      request: { name: 'a', value: 'b' },
    });
    await store.delete('a');
    expect(mocks.invoke).toHaveBeenLastCalledWith(`${P}delete`, { request: { name: 'a' } });
  });
});

describe('biometrics', () => {
  it('seals the secret as base64 with the prompt texts', async () => {
    const bio = createNativeBiometrics(true);
    expect(await bio.available()).toBe(true);
    expect(await bio.seal('vault-dek:1', new Uint8Array([1, 2, 3]), prompt)).toBe('sealed');
    expect(mocks.invoke).toHaveBeenCalledWith(`${P}biometric_seal`, {
      request: { name: 'vault-dek:1', secret: toBase64(new Uint8Array([1, 2, 3])), ...prompt },
    });
  });

  it('reports a dismissed prompt as cancelled, other failures as errors', async () => {
    const bio = createNativeBiometrics(true);
    mocks.invoke.mockRejectedValueOnce('cancelled');
    expect(await bio.seal('n', new Uint8Array([1]), prompt)).toBe('cancelled');
    mocks.invoke.mockRejectedValueOnce('keystore error: boom');
    await expect(bio.seal('n', new Uint8Array([1]), prompt)).rejects.toBe('keystore error: boom');
  });

  it('decodes the unsealed secret and passes through every status', async () => {
    const bio = createNativeBiometrics(true);
    mocks.invoke.mockResolvedValueOnce({
      status: 'ok',
      secret: toBase64(new Uint8Array([9, 8, 7])),
    });
    const res = await bio.unseal('n', prompt);
    expect(res.status === 'ok' && [...res.secret]).toEqual([9, 8, 7]);
    for (const status of ['cancelled', 'missing', 'invalidated'] as const) {
      mocks.invoke.mockResolvedValueOnce({ status });
      expect(await bio.unseal('n', prompt)).toEqual({ status });
    }
    mocks.invoke.mockResolvedValueOnce({ status: 'weird' });
    await expect(bio.unseal('n', prompt)).rejects.toThrow(/unexpected/);
    // "ok" without a secret is not an answer we accept
    mocks.invoke.mockResolvedValueOnce({ status: 'ok' });
    await expect(bio.unseal('n', prompt)).rejects.toThrow();
  });

  it('has/remove map onto the plugin', async () => {
    const bio = createNativeBiometrics(true);
    mocks.invoke.mockResolvedValueOnce({ present: true });
    expect(await bio.has('n')).toBe(true);
    await bio.remove('n');
    expect(mocks.invoke).toHaveBeenLastCalledWith(`${P}biometric_delete`, {
      request: { name: 'n' },
    });
  });

  it('is unavailable when the plugin says so', async () => {
    expect(await createNativeBiometrics(false).available()).toBe(false);
  });
});

describe('screen protection', () => {
  it('sets FLAG_SECURE through the plugin on Android only', async () => {
    await createScreenService('android').setSecure(true);
    expect(mocks.invoke).toHaveBeenCalledWith(`${P}set_secure_window`, {
      request: { enabled: true },
    });
    mocks.invoke.mockClear();
    await createScreenService('desktop').setSecure(true);
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it('never throws when the plugin fails', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    mocks.invoke.mockRejectedValueOnce('boom');
    await expect(createScreenService('android').setSecure(false)).resolves.toBeUndefined();
    warn.mockRestore();
  });
});

describe('createSecureParts', () => {
  it('uses the OS keystore and biometrics when the plugin offers them', async () => {
    mocks.invoke.mockResolvedValueOnce({ keystore: true, biometric: true });
    const parts = await createSecureParts('android');
    expect(parts.secrets.protection).toBe('os-keystore');
    expect(await parts.biometrics.available()).toBe(true);
  });

  it('falls back to the device-key store without a keystore, and without biometrics', async () => {
    mocks.invoke.mockResolvedValueOnce({ keystore: false, biometric: false });
    const parts = await createSecureParts('desktop');
    expect(parts.secrets.protection).toBe('device-key');
    expect(await parts.biometrics.available()).toBe(false);
  });

  it('survives a missing plugin', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    mocks.invoke.mockRejectedValueOnce(new Error('plugin not found'));
    const parts = await createSecureParts('desktop');
    expect(parts.secrets.protection).toBe('device-key');
    expect(await parts.biometrics.available()).toBe(false);
    warn.mockRestore();
  });
});
