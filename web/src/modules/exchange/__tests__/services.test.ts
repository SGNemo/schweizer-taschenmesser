import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import {
  createFakeExchange,
  FAKE_PEER,
  type FakeExchangeHooks,
} from '@/core/platform/fakeExchange';
import { itemRepo } from '../repo';
import { RETENTION_MS, UNDO_KEEP_MS } from '../logic';
import { deliver, pull, sweep } from '../services';

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
  const card = (over: Partial<Parameters<typeof itemRepo.create>[0]> = {}) =>
    itemRepo.create({
      peer: FAKE_PEER,
      itemId: 'e'.repeat(32),
      direction: 'out',
      kind: 'text',
      body: 'Geheim',
      state: 'waiting',
      unseen: false,
      ...over,
    });

  it('queues nothing for sync (device-local repo)', async () => {
    await db.table('_outbox').clear();
    await card();
    expect(await db.table('_outbox').count()).toBe(0);
  });

  it('two takes side by side store an item once', async () => {
    const pc = createFakeExchange('pc');
    hooks().arrive('text', 'Einmal bitte');
    await Promise.all([pull(pc), pull(pc), pull(pc)]);
    expect(await itemRepo.active().count()).toBe(1);
  });

  it('a removed card does not come back when the shell hands it out again', async () => {
    const pc = createFakeExchange('pc');
    hooks().arrive('text', 'Weg damit');
    const { items } = await pc.take();
    await pull(pc);
    const row = (await itemRepo.active().first())!;
    await itemRepo.remove(row.id);
    // as if the confirm had not landed: the shell offers the same item again
    pc.take = async () => ({ items, answers: [] });
    await pull(pc);
    expect(await itemRepo.active().count()).toBe(0);
  });

  it('the sweep really deletes old cards and removed ones past the undo window', async () => {
    const t0 = Date.now();
    await card({ itemId: '1'.repeat(32) });
    const removed = await card({ itemId: '2'.repeat(32) });
    const fresh = await card({ itemId: '3'.repeat(32) });
    await itemRepo.remove(removed.id);
    await sweep(t0 + UNDO_KEEP_MS + 60_000);
    expect(await db.table('exchange_item').get(removed.id)).toBeUndefined();
    expect(await db.table('exchange_item').get(fresh.id)).toBeDefined();
    await sweep(t0 + RETENTION_MS + 60_000);
    // the body is gone from the table, not only hidden
    expect(await db.table('exchange_item').count()).toBe(0);
  });

  it('an answer that came first is not stepped back to sent', async () => {
    const pc = createFakeExchange('pc');
    const row = await card();
    const send = pc.send;
    pc.send = async (peer, item) => {
      await send(peer, item);
      await itemRepo.update(row.id, { state: 'delivered' });
    };
    await deliver(pc, row.id);
    expect((await itemRepo.get(row.id))?.state).toBe('delivered');
  });

  it('an item the shell can never take is marked rejected', async () => {
    const pc = createFakeExchange('pc');
    const row = await card({ kind: 'link', body: 'not a link' });
    await expect(deliver(pc, row.id)).rejects.toThrow('bad-item');
    expect((await itemRepo.get(row.id))?.state).toBe('rejected');
  });
});
