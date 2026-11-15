import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { setNow } from '@/core/time/now';
import { addLink } from './index';
import { LINKS_TABLE } from './store';
import type { EntityLink } from './types';

/**
 * A second reminder in the same thread is the same `dunning` link: it carries the latest reminder's day and
 * subject, and its undo puts the earlier ones back. Every other live link stays a no-op. Invented data.
 */
const link = (rel: EntityLink['rel'], label: string, on?: string): EntityLink => ({
  from: { module: 'invoices', id: 'inv-1' },
  to: { module: 'mail', id: 'thr-dun-2' },
  rel,
  label,
  ...(on ? { on } : {}),
});
const live = async () =>
  ((await db.table(LINKS_TABLE).toArray()) as Record<string, unknown>[]).filter(
    (r) => r.deletedAt === null,
  );

let clock = new Date(2026, 10, 15, 10, 0).getTime();
beforeEach(async () => {
  setNow(() => (clock += 10));
  await db.table(LINKS_TABLE).clear();
});
afterEach(() => setNow());

describe('addLink on a live dunning link', () => {
  it('takes over the later reminder’s day and label; the undo restores the earlier ones', async () => {
    await addLink(link('dunning', 'Zahlungserinnerung', '2026-11-03'));
    const undo = await addLink(link('dunning', '2. Mahnung', '2026-11-12'));
    const rows = await live();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ label: '2. Mahnung', on: '2026-11-12' });

    await undo();
    const [back] = await live();
    expect(back).toMatchObject({ label: 'Zahlungserinnerung', on: '2026-11-03' });
  });

  it('the same reminder again writes nothing', async () => {
    await addLink(link('dunning', 'Zahlungserinnerung', '2026-11-03'));
    const before = JSON.stringify(await live());
    await (
      await addLink(link('dunning', 'Zahlungserinnerung', '2026-11-03'))
    )();
    expect(JSON.stringify(await live())).toBe(before);
  });

  it('an origin link stays a no-op: label and day of the first add are kept', async () => {
    await addLink(link('origin', 'Ihre Rechnung', '2026-10-20'));
    const before = JSON.stringify(await live());
    const undo = await addLink(link('origin', 'AW: Ihre Rechnung', '2026-10-25'));
    expect(JSON.stringify(await live())).toBe(before);
    await undo();
    expect(JSON.stringify(await live())).toBe(before);
  });
});
