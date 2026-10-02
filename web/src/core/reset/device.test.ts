import Dexie from 'dexie';
import { describe, expect, it, vi } from 'vitest';
import { TaschenmesserDB } from '@/core/db/db';
import type { SecretStore } from '@/core/secrets/types';
import { deviceSecretNames, resetDevice, RESET_PHRASE } from './device';

function memorySecrets(
  initial: Record<string, string>,
): SecretStore & { map: Map<string, string> } {
  const map = new Map(Object.entries(initial));
  return {
    map,
    protection: 'device-key',
    get: async (n) => map.get(n),
    set: async (n, v) => void map.set(n, v),
    delete: async (n) => void map.delete(n),
  };
}

describe('device reset', () => {
  it('asks for the phrase LÖSCHEN', () => expect(RESET_PHRASE).toBe('LÖSCHEN'));

  it('names the AI keys, the backup password and the connector secrets', async () => {
    const database = new TaschenmesserDB(`reset-names-${Math.random()}`);
    const names = await deviceSecretNames(database);
    expect(names).toContain('backup.autoPassphrase');
    expect(names).toContain('oauth:google:refresh');
    expect(names).toContain('connector:ics:subscriptions');
    database.close();
  });

  it('deletes the secrets and tm-* preferences, removes the database and reloads', async () => {
    const database = new TaschenmesserDB(`reset-run-${Math.random()}`);
    await database.open();
    const secrets = memorySecrets({
      'backup.autoPassphrase': 'x',
      'oauth:google:refresh': 'y',
      other: 'keep',
    });
    const store = new Map([
      ['tm-theme', 'dark'],
      ['unrelated', '1'],
    ]);
    const storage = {
      get length() {
        return store.size;
      },
      key: (i: number) => [...store.keys()][i] ?? null,
      removeItem: (k: string) => void store.delete(k),
    };
    const reload = vi.fn();
    await resetDevice({ database, secrets, storage, reload });
    expect([...secrets.map.keys()]).toEqual(['other']);
    expect([...store.keys()]).toEqual(['unrelated']);
    expect(reload).toHaveBeenCalledOnce();
    expect(await Dexie.exists(database.name)).toBe(false);
  });
});
