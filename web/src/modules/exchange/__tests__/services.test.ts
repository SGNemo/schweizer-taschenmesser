import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import {
  createFakeExchange,
  FAKE_PEER,
  type FakeExchangeHooks,
} from '@/core/platform/fakeExchange';
import { itemRepo } from '../repo';
import { deliver, pull } from '../services';

const hooks = () => (globalThis as { __exchangeFake?: FakeExchangeHooks }).__exchangeFake!;

describe('exchange background work', () => {
  beforeEach(async () => {
    await db.table('exchange_item').clear();
  });

  it('PC: takes received items over once, confirms them, and records the answers', async () => {
    const pc = createFakeExchange('pc');
    hooks().arrive('link', 'https://example.org/fahrplan');
    await pull(pc);
    await pull(pc);
    const rows = await itemRepo.active().toArray();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      direction: 'in',
      kind: 'link',
      state: 'received',
      unseen: true,
    });
    expect((await pc.take()).items).toHaveLength(0);

    await pc.setEnabled(true);
    await pc.setDevice(FAKE_PEER, true, false);
    const out = await itemRepo.create({
      peer: FAKE_PEER,
      itemId: 'c'.repeat(32),
      direction: 'out',
      kind: 'text',
      body: 'Hallo Handy',
      state: 'waiting',
      unseen: false,
    });
    await deliver(pc, out.id);
    expect((await itemRepo.get(out.id))?.state).toBe('sent');
    hooks().answer('c'.repeat(32), 'delivered');
    await pull(pc);
    expect((await itemRepo.get(out.id))?.state).toBe('delivered');
    expect((await pc.take()).answers).toHaveLength(0);
  });

  it('phone: without a session a card stays waiting', async () => {
    const phone = createFakeExchange('phone');
    const out = await itemRepo.create({
      peer: 'pc',
      itemId: 'd'.repeat(32),
      direction: 'out',
      kind: 'text',
      body: 'Notiz',
      state: 'waiting',
      unseen: false,
    });
    await deliver(phone, out.id);
    expect((await itemRepo.get(out.id))?.state).toBe('waiting');
  });
});
