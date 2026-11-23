import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { setNow } from '@/core/time/now';
import { itemRepo } from '../repo';
import { HISTORY_PER_DEVICE } from '../logic';
import { sweep } from '../services';

// E1 (launch review 2026-11): a paired device cannot grow this device's history without end.
describe('exchange history per device', () => {
  let clock = Date.UTC(2026, 10, 23, 12, 0, 0);
  beforeEach(async () => {
    await db.table('exchange_item').clear();
    setNow(() => clock);
  });
  afterEach(() => setNow());

  const received = (peer: string, n: number) => {
    clock += 1000;
    return itemRepo.create({
      peer,
      itemId: n.toString(16).padStart(32, '0'),
      direction: 'in',
      kind: 'text',
      body: `Nachricht ${n}`,
      state: 'received',
      unseen: false,
    });
  };

  it('keeps the newest received cards of each device and leaves the rest alone', async () => {
    for (let n = 0; n < HISTORY_PER_DEVICE + 5; n++) await received('a'.repeat(64), n);
    for (let n = 0; n < 3; n++) await received('b'.repeat(64), 100_000 + n);
    const mine = await itemRepo.create({
      peer: 'a'.repeat(64),
      itemId: 'f'.repeat(32),
      direction: 'out',
      kind: 'text',
      body: 'Eigene Nachricht',
      state: 'delivered',
      unseen: false,
    });
    await sweep(clock);
    const left = await db.table('exchange_item').toArray();
    const ofA = left.filter((r) => r.peer === 'a'.repeat(64) && r.direction === 'in');
    expect(ofA).toHaveLength(HISTORY_PER_DEVICE);
    // the oldest five went
    expect(ofA.some((r) => r.body === 'Nachricht 0')).toBe(false);
    expect(ofA.some((r) => r.body === 'Nachricht 5')).toBe(true);
    expect(left.filter((r) => r.peer === 'b'.repeat(64))).toHaveLength(3);
    expect(left.some((r) => r.id === mine.id)).toBe(true);
  }, 30_000);
});
