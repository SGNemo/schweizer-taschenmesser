import { beforeEach, describe, expect, it } from 'vitest';
import { db } from '@/core/db/db';
import { collectCalendarItems, collectNotifications } from '@/core/modules/contributions';
import { validateManifest } from '@/core/modules/registry';
import { toEpoch } from '@/core/time/dates';
import { cancelDeadline, nextRelevantDate, sortContracts, statusOf } from '../logic';
import manifest from '../manifest';
import { contractRepo } from '../repo';
import { contractSchema } from '../schema';

beforeEach(async () => {
  await db.table('contracts_contract').clear();
  await db.table('_settings').clear();
});

const TODAY = '2026-09-29';
const c = (over: Record<string, unknown> = {}) =>
  contractSchema.parse({ name: 'Handyvertrag', ...over });

describe('contract logic', () => {
  it('validates dates', () => {
    expect(
      contractSchema.safeParse({ name: 'x', startDate: '2026-02-01', endDate: '2026-01-01' })
        .success,
    ).toBe(false);
    expect(contractSchema.safeParse({ name: 'x', noticeDays: -1 }).success).toBe(false);
    expect(c().kind).toBe('contract');
  });

  it('derives the cancellation deadline', () => {
    expect(cancelDeadline(c({ endDate: '2026-12-31', noticeDays: 90 }))).toBe('2026-10-02');
    expect(cancelDeadline(c({ endDate: '2026-12-31' }))).toBeUndefined();
    expect(cancelDeadline(c({ noticeDays: 30 }))).toBeUndefined();
    expect(cancelDeadline(c({ endDate: '2026-03-01', noticeDays: 0 }))).toBe('2026-03-01');
  });

  it.each([
    [{}, 'open-ended'],
    [{ endDate: '2026-09-28' }, 'expired'],
    [{ endDate: '2026-12-31', noticeDays: 90 }, 'act-now'], // deadline 2026-10-02, 3 days away
    [{ endDate: '2026-12-31', noticeDays: 60 }, 'ok'], // deadline 2026-11-01
    [{ endDate: '2026-12-31', noticeDays: 70 }, 'soon'], // deadline 2026-10-22
    [{ endDate: '2026-10-20', kind: 'warranty' }, 'soon'],
    [{ endDate: '2027-06-01', kind: 'warranty' }, 'ok'],
    [{ endDate: '2026-10-05', noticeDays: 30 }, 'soon'], // deadline passed, end within 30 days
    [{ endDate: '2026-09-29', noticeDays: 0 }, 'act-now'], // last day today
  ])('status of %j is %s', (over, status) => {
    expect(statusOf(c(over), TODAY)).toBe(status);
  });

  it('points to the deadline while ahead, otherwise to the end', () => {
    expect(nextRelevantDate(c({ endDate: '2026-12-31', noticeDays: 90 }), TODAY)).toBe(
      '2026-10-02',
    );
    expect(nextRelevantDate(c({ endDate: '2026-10-05', noticeDays: 30 }), TODAY)).toBe(
      '2026-10-05',
    );
    expect(nextRelevantDate(c(), TODAY)).toBeUndefined();
  });

  it('sorts urgent first, expired and open-ended last', () => {
    const list = [
      c({ name: 'abgelaufen', endDate: '2026-01-01' }),
      c({ name: 'unbefristet' }),
      c({ name: 'später', endDate: '2027-05-01' }),
      c({ name: 'dringend', endDate: '2026-12-31', noticeDays: 90 }),
    ];
    expect(sortContracts(list, TODAY).map((x) => x.name)).toEqual([
      'dringend',
      'später',
      'unbefristet',
      'abgelaufen',
    ]);
  });
});

describe('contracts module', () => {
  it('has a valid manifest and is off by default', () => {
    expect(validateManifest(manifest)).toEqual([]);
    expect(manifest.defaultEnabled).toBe(false);
  });

  it('puts end and cancellation deadline on the calendar', async () => {
    await contractRepo.create(c({ endDate: '2026-12-31', noticeDays: 90 }));
    await contractRepo.create(c({ name: 'ohne Ende' }));
    const items = await collectCalendarItems({ from: '2026-09-01', to: '2026-12-31' }, [manifest]);
    expect(items.map((i) => [i.date, i.kind])).toEqual([
      ['2026-10-02', 'cancel'],
      ['2026-12-31', 'end'],
    ]);
  });

  it('reminds ahead of the deadline, once', async () => {
    await contractRepo.create(c({ endDate: '2026-12-31', noticeDays: 90 }));
    // default: 14 days before 2026-10-02 at 09:00 → 2026-09-18 09:00
    const at = toEpoch('2026-09-18', '09:00');
    const found = await collectNotifications({ from: at - 1000, to: at + 1000 }, [manifest]);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ at, key: expect.stringContaining('2026-10-02') as string });
    expect(
      await collectNotifications({ from: at + 1000, to: at + 86_400_000 }, [manifest]),
    ).toEqual([]);
  });
});
