import { describe, expect, it, vi } from 'vitest';
import { bus } from '@/core/events/bus';
import { createFakeExchange } from '@/core/platform/fakeExchange';

const pc = createFakeExchange('pc');
vi.mock('@/core/platform', () => ({ getPlatform: () => ({ exchange: pc }) }));

describe('exchange module switched off', () => {
  it('switches the PC exchange off before the module goes off', async () => {
    const { default: start } = await import('../services');
    await pc.setEnabled(true);
    const stop = start();
    await bus.emit('module.disabling', { moduleId: 'other', policy: 'keep' });
    expect((await pc.status()).enabled).toBe(true);
    await bus.emit('module.disabling', { moduleId: 'exchange', policy: 'keep' });
    expect((await pc.status()).enabled).toBe(false);
    stop();
  });
});
