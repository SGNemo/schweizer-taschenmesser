import { describe, expect, it, vi } from 'vitest';
import { createMigratingStore } from './migrating';
import type { SecretStore } from './types';

function memory(protection: SecretStore['protection'] = 'device-key') {
  const map = new Map<string, string>();
  const store: SecretStore & { map: Map<string, string> } = {
    protection,
    map,
    get: async (n) => map.get(n),
    set: async (n, v) => void map.set(n, v),
    delete: async (n) => void map.delete(n),
  };
  return store;
}

describe('migrating secret store', () => {
  it('reports the protection of the primary store', () => {
    expect(createMigratingStore(memory('os-keystore'), memory()).protection).toBe('os-keystore');
  });

  it('moves a legacy secret into the keystore on first read and removes the old copy', async () => {
    const primary = memory('os-keystore');
    const legacy = memory();
    legacy.map.set('ai-key:groq', 'gsk-1');
    const store = createMigratingStore(primary, legacy);
    expect(await store.get('ai-key:groq')).toBe('gsk-1');
    expect(primary.map.get('ai-key:groq')).toBe('gsk-1');
    expect(legacy.map.has('ai-key:groq')).toBe(false);
    expect(await store.get('ai-key:groq')).toBe('gsk-1'); // now served by the keystore
    expect(await store.get('nothing')).toBeUndefined();
  });

  it('prefers the keystore value', async () => {
    const primary = memory('os-keystore');
    const legacy = memory();
    primary.map.set('k', 'new');
    legacy.map.set('k', 'old');
    expect(await createMigratingStore(primary, legacy).get('k')).toBe('new');
  });

  it('writes to the keystore and clears any legacy copy', async () => {
    const primary = memory('os-keystore');
    const legacy = memory();
    legacy.map.set('k', 'old');
    await createMigratingStore(primary, legacy).set('k', 'new');
    expect(primary.map.get('k')).toBe('new');
    expect(legacy.map.has('k')).toBe(false);
  });

  it('keeps a secret in the legacy store when the keystore fails – and moves it later', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const primary = memory('os-keystore');
      let broken = true;
      const set = primary.set;
      primary.set = async (n, v) => {
        if (broken) throw new Error('keystore locked');
        return set(n, v);
      };
      const legacy = memory();
      const store = createMigratingStore(primary, legacy);
      await store.set('k', 'v');
      expect(legacy.map.get('k')).toBe('v');
      broken = false;
      expect(await store.get('k')).toBe('v');
      expect(primary.map.get('k')).toBe('v');
      expect(legacy.map.has('k')).toBe(false);
    } finally {
      warn.mockRestore();
    }
  });

  it('falls back to the legacy store when the keystore cannot be read', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    try {
      const primary = memory('os-keystore');
      primary.get = async () => {
        throw new Error('boom');
      };
      const legacy = memory();
      legacy.map.set('k', 'v');
      expect(await createMigratingStore(primary, legacy).get('k')).toBe('v');
    } finally {
      warn.mockRestore();
    }
  });

  it('deletes everywhere, even if one side fails', async () => {
    const primary = memory('os-keystore');
    primary.delete = async () => {
      throw new Error('x');
    };
    const legacy = memory();
    legacy.map.set('k', 'v');
    await createMigratingStore(primary, legacy).delete('k');
    expect(legacy.map.has('k')).toBe(false);
  });
});
