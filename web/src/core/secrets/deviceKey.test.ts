import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { createDeviceKeyStore } from './deviceKey';

// The store of the web platform (and the fallback of the native shells).
beforeEach(async () => {
  await db.table('_secrets').clear();
});

describe('device-key store: has', () => {
  it('answers only yes/no and agrees with get', async () => {
    const store = createDeviceKeyStore(db);
    expect(await store.has('backup.autoPassphrase')).toBe(false);
    await store.set('backup.autoPassphrase', 'a-long-test-passphrase');
    const answer = await store.has('backup.autoPassphrase');
    expect(answer).toBe(true);
    expect(typeof answer).toBe('boolean');
    await store.delete('backup.autoPassphrase');
    expect(await store.has('backup.autoPassphrase')).toBe(false);
  });

  it('counts an empty value as not set, like get', async () => {
    const store = createDeviceKeyStore(db);
    await store.set('k', '');
    expect(await store.get('k')).toBe('');
    expect(await store.has('k')).toBe(false);
  });

  it('counts a value that cannot be opened (device key replaced) as not set', async () => {
    const store = createDeviceKeyStore(db);
    await store.set('k', 'v');
    await db.table('_secrets').delete('deviceKey');
    expect(await store.get('k')).toBeUndefined();
    expect(await store.has('k')).toBe(false);
  });
});
