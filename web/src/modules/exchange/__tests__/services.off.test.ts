import { beforeEach, describe, expect, it, vi } from 'vitest';
import { db } from '@/core/db/db';
import { createFakeExchange } from '@/core/platform/fakeExchange';

const pc = createFakeExchange('pc');
vi.mock('@/core/platform', () => ({ getPlatform: () => ({ exchange: pc }) }));

const setStored = (enabled: boolean) =>
  db.table('_modules').put({
    id: 'exchange',
    enabled,
    dataPolicy: null,
    createdAt: 1,
    updatedAt: 1,
    deviceId: 't',
    deletedAt: null,
    _f: {},
  });

describe('exchange module switched off', () => {
  beforeEach(() => pc.setEnabled(true));

  it('switches the PC exchange off when the module is off (here or by sync)', async () => {
    const { default: start } = await import('../services');
    await setStored(true);
    const stop = start();
    await setStored(false);
    stop();
    await vi.waitFor(async () => expect((await pc.status()).enabled).toBe(false));
  });

  it('leaves it on when the app only quits', async () => {
    const { default: start } = await import('../services');
    await setStored(true);
    const stop = start();
    stop();
    await new Promise((r) => setTimeout(r, 50));
    expect((await pc.status()).enabled).toBe(true);
  });
});
