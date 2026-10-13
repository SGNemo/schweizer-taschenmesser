import Dexie from 'dexie';
import { describe, expect, it, vi } from 'vitest';
import { createKeychain, serializeHeader, vaultSealName } from '@/core/crypto';
import { TaschenmesserDB } from '@/core/db/db';
import type { SecretStore } from '@/core/secrets/types';
import { deviceSecretNames, resetDevice, RESET_PHRASE, vaultSealNames } from './device';

const FAST = { m: 64, t: 1, p: 1 };

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
    await resetDevice({
      database,
      secrets,
      storage,
      reload,
      biometrics: { remove: async () => {} },
    });
    expect([...secrets.map.keys()]).toEqual(['other']);
    expect([...store.keys()]).toEqual(['unrelated']);
    expect(reload).toHaveBeenCalledOnce();
    expect(await Dexie.exists(database.name)).toBe(false);
  });

  it('drops the biometric seal of the vault before the database goes (even when the OS call fails)', async () => {
    const database = new TaschenmesserDB(`reset-seal-${Math.random()}`);
    await database.open();
    const { header } = await createKeychain('Master-Passwort 1', FAST);
    await database.table('accounts_vault').put({
      id: 'vault',
      header: serializeHeader(header),
      createdAt: 1,
      updatedAt: 1,
      deviceId: 'd',
      deletedAt: null,
      _f: {},
    });
    expect(await vaultSealNames(database)).toEqual([vaultSealName(header.vaultId)]);

    const remove = vi.fn(async () => {
      throw new Error('keystore unavailable');
    });
    const reload = vi.fn();
    await resetDevice({
      database,
      secrets: memorySecrets({}),
      storage: undefined,
      reload,
      biometrics: { remove },
    });
    expect(remove).toHaveBeenCalledWith(vaultSealName(header.vaultId));
    expect(reload).toHaveBeenCalledOnce();
    expect(await Dexie.exists(database.name)).toBe(false);
  });

  it('names no seal without a vault or with an unreadable header', async () => {
    const database = new TaschenmesserDB(`reset-noseal-${Math.random()}`);
    await database.open();
    expect(await vaultSealNames(database)).toEqual([]);
    await database.table('accounts_vault').put({ id: 'vault', header: '{not json' });
    expect(await vaultSealNames(database)).toEqual([]);
    database.close();
  });
});
