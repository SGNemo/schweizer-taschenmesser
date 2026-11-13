import { describe, expect, it, vi } from 'vitest';
import type { SecretStore } from '@/core/secrets/types';
import { hasAutoPassphrase, setAutoPassphrase } from './auto';

function store(): SecretStore & { get: ReturnType<typeof vi.fn> } {
  const map = new Map<string, string>();
  return {
    protection: 'os-keystore',
    get: vi.fn(async (n: string) => map.get(n)),
    has: async (n) => Boolean(map.get(n)),
    set: async (n, v) => void map.set(n, v),
    delete: async (n) => void map.delete(n),
  };
}

describe('hasAutoPassphrase', () => {
  it('answers yes/no without fetching the passphrase into the web view', async () => {
    const secrets = store();
    expect(await hasAutoPassphrase(secrets)).toBe(false);
    expect(await setAutoPassphrase('a-long-test-passphrase', secrets)).toBe(true);
    expect(await hasAutoPassphrase(secrets)).toBe(true);
    expect(secrets.get).not.toHaveBeenCalled();
  });
});
