import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFakeExchange, FAKE_PEER, type FakeExchangeHooks } from './fakeExchange';

const hooks = () => (globalThis as { __exchangeFake?: FakeExchangeHooks }).__exchangeFake!;

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('fake exchange (e2e builds)', () => {
  it('PC: queued items wait until module, grant and connection allow, then are answered', async () => {
    const pc = createFakeExchange('pc');
    const s = await pc.status();
    expect(s.enabled).toBe(false);
    expect(s.devices).toHaveLength(1);
    expect(s.devices[0]).toMatchObject({ id: FAKE_PEER, on: false });
    const item = { id: 'a'.repeat(32), kind: 'text' as const, body: 'x' };
    await pc.send(FAKE_PEER, item);
    vi.advanceTimersByTime(1000);
    expect((await pc.status()).queued).toHaveLength(1);
    await pc.setEnabled(true);
    hooks().setConnected(false);
    await pc.setDevice(FAKE_PEER, true, false);
    vi.advanceTimersByTime(1000);
    expect((await pc.status()).queued).toHaveLength(1);
    const heard = vi.fn();
    pc.onChanged(heard);
    hooks().setConnected(true);
    vi.advanceTimersByTime(400);
    expect(heard).toHaveBeenCalled();
    const { answers } = await pc.take();
    expect(answers).toEqual([{ peer: FAKE_PEER, id: item.id, state: 'delivered' }]);
    // answers stay until confirmed
    expect((await pc.take()).answers).toHaveLength(1);
    await pc.confirm([], [{ peer: FAKE_PEER, id: item.id }]);
    expect((await pc.take()).answers).toHaveLength(0);
    await expect(
      pc.send(FAKE_PEER, { id: 'b'.repeat(32), kind: 'link', body: 'javascript:x' }),
    ).rejects.toThrow('bad-item');
  });

  it('phone: refusals, answers, the PC ending it, and nothing after close', async () => {
    const phone = createFakeExchange('phone');
    hooks().refuseOpen('limit:12');
    await expect(phone.open(() => {})).rejects.toThrow('limit:12');
    hooks().refuseOpen(null);
    const events: unknown[] = [];
    const s = await phone.open((e) => events.push(e));
    await s.send({ id: 'b'.repeat(32), kind: 'link', body: 'https://example.org' });
    vi.advanceTimersByTime(300);
    expect(events).toContainEqual({ type: 'answer', id: 'b'.repeat(32), state: 'delivered' });
    hooks().arrive('text', 'vom PC');
    expect(events).toContainEqual({ type: 'received' });
    const { items } = await phone.take();
    expect(items).toHaveLength(1);
    await phone.confirm(items.map((i) => ({ peer: i.peer, id: i.id })));
    expect((await phone.take()).items).toHaveLength(0);
    hooks().closeSession('paused');
    expect(events).toContainEqual({ type: 'closed', reason: 'paused', minutes: null });
    await expect(s.ping()).rejects.toThrow('closed');
  });
});
