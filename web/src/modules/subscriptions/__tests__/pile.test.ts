/**
 * Cancellation deadlines as a part of „Finanzen checken“ (planner hub 2, package 2): within 14 days only, by key, a
 * fixed route – never a name or a price.
 */
import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import source, { NOTICE_ROUTE } from '../pile';

const stamp = { createdAt: 1, updatedAt: 1, deviceId: 't', deletedAt: null, _f: {} };

beforeEach(async () => {
  await db.table('subscriptions_subscription').clear();
  await db.table('subscriptions_subscription').put({
    id: 's1',
    name: 'Streamingdienst Beispiel',
    amountMinor: 1299,
    startDate: '2026-01-10',
    recurrence: { freq: 'monthly', interval: 1 },
    cancelNoticeDays: 7,
    active: true,
    ...stamp,
  });
});

describe('the subscriptions part', () => {
  it('names the deadline within 14 days by its row key; nothing later, no name, no price', async () => {
    const [part] = await source({ today: '2026-11-30', until: '2027-01-30' });
    expect(part).toMatchObject({ area: 'money', count: 0, to: NOTICE_ROUTE });
    expect(part?.members).toEqual(['subscriptions:s1:2026-12-03']);
    expect(JSON.stringify(part)).not.toMatch(/Streaming|12,99|1299/);
    expect(NOTICE_ROUTE).toBe('/subscriptions?view=notice');
  });
});
