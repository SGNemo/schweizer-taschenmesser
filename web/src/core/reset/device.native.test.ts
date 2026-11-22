/**
 * "Alle Daten löschen" with a fake platform: the native part (hub, pairings, downloads …), the
 * push subscription and the partner-share codes, in the right order, and no failing step stops it.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { TaschenmesserDB } from '@/core/db/db';
import { getPlatform, setPlatform } from '@/core/platform';
import type { DeviceWipeService } from '@/core/platform/deviceWipe';
import type { SecretStore } from '@/core/secrets/types';
import { resetDevice } from './device';

type Log = string[];

function fakeSecrets(log: Log, initial: Record<string, string>, failOn?: string): SecretStore {
  const map = new Map(Object.entries(initial));
  return {
    protection: 'device-key',
    get: async (n) => map.get(n),
    has: async (n) => map.has(n),
    set: async (n, v) => void map.set(n, v),
    delete: async (n) => {
      log.push(`secret:${n}`);
      if (n === failOn) throw new Error('keystore');
      map.delete(n);
    },
  };
}

function fakeNative(log: Log, fail = false): DeviceWipeService & { calls: unknown[] } {
  const calls: unknown[] = [];
  return {
    supported: true,
    calls,
    wipe: async (options) => {
      calls.push(options);
      log.push('native');
      if (fail) throw new Error('native');
      return { failed: [], kept: ['pc-care'] };
    },
  };
}

async function databaseWithSharePair(log: Log): Promise<TaschenmesserDB> {
  const database = new TaschenmesserDB(`reset-native-${Math.random()}`);
  await database.open();
  await database.table('_meta').put({
    key: 'share.pairs',
    value: [{ id: 'pair-1', name: 'Erfundene Partnerin', modules: ['todos'], createdAt: 1 }],
  });
  const del = database.delete.bind(database);
  database.delete = (async () => {
    log.push('database');
    return del();
  }) as typeof database.delete;
  return database;
}

afterEach(() => setPlatform(undefined));

describe('device reset – native part, push and share codes', () => {
  it('runs push, native, secrets, seals, database, reload in that order', async () => {
    const log: Log = [];
    const database = await databaseWithSharePair(log);
    const native = fakeNative(log);
    const report = await resetDevice(
      {
        database,
        secrets: fakeSecrets(log, { 'share.code.pair-1': 'CODE' }),
        biometrics: { remove: async (n) => void log.push(`seal:${n}`) },
        storage: undefined,
        native,
        disablePush: async (db) => {
          // still readable: the subscription is in the database
          expect(db.isOpen()).toBe(true);
          log.push('push');
        },
        reload: () => log.push('reload'),
      },
      { models: true },
    );
    const at = (s: string) => log.indexOf(s);
    expect(at('push')).toBeGreaterThanOrEqual(0);
    expect(at('push')).toBeLessThan(at('native'));
    expect(at('native')).toBeLessThan(at('secret:share.code.pair-1'));
    expect(at('secret:share.code.pair-1')).toBeLessThan(at('database'));
    expect(log.findIndex((l) => l.startsWith('seal:'))).toBeLessThan(at('database'));
    expect(log.at(-1)).toBe('reload');
    expect(native.calls).toEqual([{ models: true }]);
    expect(report).toEqual({ failed: [], kept: ['pc-care'] });
  });

  it('models stay unless ticked', async () => {
    const log: Log = [];
    const native = fakeNative(log);
    await resetDevice({
      database: await databaseWithSharePair(log),
      secrets: fakeSecrets(log, {}),
      biometrics: { remove: async () => {} },
      storage: undefined,
      native,
      disablePush: async () => {},
      reload: () => {},
    });
    expect(native.calls).toEqual([{ models: false }]);
  });

  it('a failing native part, push call or keystore entry never stops the reset', async () => {
    const log: Log = [];
    const database = await databaseWithSharePair(log);
    const reload = vi.fn();
    const report = await resetDevice({
      database,
      secrets: fakeSecrets(log, { 'share.code.pair-1': 'CODE' }, 'share.code.pair-1'),
      biometrics: {
        remove: async () => {
          throw new Error('os');
        },
      },
      storage: undefined,
      native: fakeNative(log, true),
      disablePush: async () => {
        throw new Error('server unreachable');
      },
      reload,
    });
    expect(log).toContain('native');
    expect(log).toContain('secret:share.code.pair-1');
    expect(log).toContain('database');
    expect(reload).toHaveBeenCalledOnce();
    expect(report).toEqual({ failed: ['native'], kept: [] });
  });

  it('uses the platform’s native part when none is passed, and skips it where unsupported', async () => {
    const log: Log = [];
    const native = fakeNative(log);
    setPlatform({ ...getPlatform(), deviceWipe: native });
    await resetDevice({
      database: await databaseWithSharePair(log),
      secrets: fakeSecrets(log, {}),
      biometrics: { remove: async () => {} },
      storage: undefined,
      disablePush: async () => {},
      reload: () => {},
    });
    expect(native.calls).toHaveLength(1);

    const unsupported = { ...fakeNative(log), supported: false };
    const report = await resetDevice({
      database: await databaseWithSharePair(log),
      secrets: fakeSecrets(log, {}),
      biometrics: { remove: async () => {} },
      storage: undefined,
      native: unsupported,
      disablePush: async () => {},
      reload: () => {},
    });
    expect(unsupported.calls).toEqual([]);
    expect(report).toBeUndefined();
  });
});
