import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeExchange, FAKE_PEER } from './fakeExchange';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('fake exchange (e2e builds)', () => {
  it('PC: off until switched on, a sent item is answered delivered', async () => {
    const pc = createFakeExchange('pc');
    const s = await pc.status();
    expect(s.enabled).toBe(false);
    expect(s.devices[0]).toMatchObject({ id: FAKE_PEER, on: false });
    expect(s.devices).toHaveLength(1);
    await pc.setEnabled(true);
    await pc.setDevice(FAKE_PEER, true, false);
    expect((await pc.status()).devices[0]?.on).toBe(true);
    const heard = vi.fn();
    pc.onChanged(heard);
    await pc.send(FAKE_PEER, { id: 'a'.repeat(32), kind: 'text', body: 'x' });
    expect((await pc.status()).queued).toHaveLength(1);
    vi.advanceTimersByTime(400);
    expect(heard).toHaveBeenCalled();
    expect((await pc.take()).answers).toEqual([
      { peer: FAKE_PEER, id: 'a'.repeat(32), state: 'delivered' },
    ]);
  });

  it('phone: an open session answers what it sends; arrivals are taken and confirmed', async () => {
    const phone = createFakeExchange('phone');
    const events: unknown[] = [];
    const s = await phone.open((e) => events.push(e));
    await s.send({ id: 'b'.repeat(32), kind: 'link', body: 'https://example.org' });
    vi.advanceTimersByTime(300);
    expect(events).toContainEqual({ type: 'answer', id: 'b'.repeat(32), state: 'delivered' });
    (
      globalThis as { __exchangeFake?: { arrive(k: string, b: string): void } }
    ).__exchangeFake?.arrive('text', 'vom PC');
    const { items } = await phone.take();
    expect(items).toHaveLength(1);
    await phone.confirm(items.map((i) => i.id));
    expect((await phone.take()).items).toHaveLength(0);
  });
});
