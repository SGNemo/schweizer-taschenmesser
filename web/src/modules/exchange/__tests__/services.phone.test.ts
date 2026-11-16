// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { createFakeExchange } from '@/core/platform/fakeExchange';
import { useExchangeView } from '../state';

const phone = createFakeExchange('phone');
vi.mock('@/core/platform', () => ({ getPlatform: () => ({ exchange: phone }) }));

describe('exchange on the phone', () => {
  it('keeps the session when taking over fails, and closes it when the module stops', async () => {
    phone.take = () => Promise.reject(new Error('storage'));
    const { default: start } = await import('../services');
    const stop = start();
    await vi.waitFor(() => expect(useExchangeView.getState().open).toBe(true));
    expect(useExchangeView.getState().problem).toBeNull();
    stop();
    expect(useExchangeView.getState().open).toBe(false);
  });
  it('closes a session that opens after the module stopped', async () => {
    const { default: start } = await import('../services');
    let resolve!: (s: Awaited<ReturnType<typeof phone.open>>) => void;
    const close = vi.fn(async () => undefined);
    phone.open = () => new Promise((r) => (resolve = r));
    const stop = start();
    stop();
    resolve({ send: async () => undefined, ping: async () => undefined, close });
    await vi.waitFor(() => expect(close).toHaveBeenCalled());
    expect(useExchangeView.getState().open).toBe(false);
  });
});
