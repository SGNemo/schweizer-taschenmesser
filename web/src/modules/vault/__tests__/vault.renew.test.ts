import { describe, expect, it } from 'vitest';
import {
  canRenew,
  countByCategory,
  deadlineRows,
  RENEWABLE,
  renewedEnd,
  renewPatch,
} from '../logic';
import type { VaultDocument } from '../schema';

const doc = (over: Partial<VaultDocument>): VaultDocument => ({
  title: 'X',
  category: 'contract',
  ...over,
});

describe('renewal: one more term of the same length', () => {
  it('a year from 1 Jan to 31 Dec ends on 31 Dec of the next year', () => {
    expect(renewedEnd({ startDate: '2026-01-01', endDate: '2026-12-31' })).toBe('2027-12-31');
  });

  it('a month from 1 Feb to 28 Feb ends on 31 Mar (whole months, not 28 days)', () => {
    expect(renewedEnd({ startDate: '2027-02-01', endDate: '2027-02-28' })).toBe('2027-03-31');
  });

  it('leap years: a year that ends on 29 Feb ends on 28 Feb the year after, and the other way round', () => {
    expect(renewedEnd({ startDate: '2027-03-01', endDate: '2028-02-29' })).toBe('2029-02-28');
    expect(renewedEnd({ startDate: '2027-03-01', endDate: '2028-02-29' })).not.toBe('2029-03-01');
    expect(renewedEnd({ startDate: '2023-03-01', endDate: '2024-02-29' })).toBe('2025-02-28');
    expect(renewedEnd({ startDate: '2027-02-28', endDate: '2028-02-27' })).toBe('2029-02-27');
  });

  it('two years stay two years; the legacy end field counts as the end', () => {
    expect(renewedEnd({ startDate: '2024-07-15', endDate: '2026-07-14' })).toBe('2028-07-14');
    expect(renewedEnd({ startDate: '2026-01-01', expiresOn: '2026-06-30' })).toBe('2026-12-31');
  });

  it('a term that is no whole number of months moves by its days', () => {
    // 10 Jan – 24 Jan inclusive = 15 days → the next 15 days end on 8 Feb.
    expect(renewedEnd({ startDate: '2026-01-10', endDate: '2026-01-24' })).toBe('2026-02-08');
    // A single day.
    expect(renewedEnd({ startDate: '2026-05-05', endDate: '2026-05-05' })).toBe('2026-05-06');
  });

  it('proposes nothing without a start (a passport, the vehicle inspection) or without an end', () => {
    expect(renewedEnd({ endDate: '2026-12-31' })).toBeUndefined();
    expect(renewedEnd({ expiresOn: '2026-06-01' })).toBeUndefined();
    expect(renewedEnd({ startDate: '2026-01-01' })).toBeUndefined();
    expect(renewedEnd({})).toBeUndefined();
  });

  it('the patch moves the start to the new term, so the next renewal is one term again', () => {
    const first = { startDate: '2026-01-01', endDate: '2026-12-31' };
    const patch = renewPatch(first, renewedEnd(first)!);
    expect(patch).toEqual({ startDate: '2027-01-01', endDate: '2027-12-31', expiresOn: undefined });
    expect(renewedEnd(patch)).toBe('2028-12-31');
    // Without a start none is invented; the legacy field is replaced by the new end.
    expect(renewPatch({ expiresOn: '2026-06-01' }, '2036-06-01')).toEqual({
      startDate: undefined,
      endDate: '2036-06-01',
      expiresOn: undefined,
    });
  });

  it('is offered for what is renewed, once the end or the deadline has come', () => {
    expect(RENEWABLE).toEqual(['identity', 'insurance', 'contract', 'health', 'other']);
    expect(canRenew({ category: 'identity' }, 'expired')).toBe(true);
    expect(canRenew({ category: 'contract' }, 'act-now')).toBe(true);
    expect(canRenew({ category: 'insurance' }, 'missed')).toBe(true);
    expect(canRenew({ category: 'contract' }, 'soon')).toBe(false);
    expect(canRenew({ category: 'contract' }, 'ok')).toBe(false);
    expect(canRenew({ category: 'warranty' }, 'expired')).toBe(false);
    expect(canRenew({ category: 'tax' }, 'expired')).toBe(false);
  });
});

describe('deadline timeline rows', () => {
  const TODAY = '2026-09-29';
  it('lists dated documents oldest first, leaves undated ones out, and names what the date is', () => {
    const rows = deadlineRows(
      [
        doc({ title: 'Mietvertrag' }),
        doc({ title: 'Reisepass', category: 'identity', endDate: '2026-11-06' }),
        doc({ title: 'Impfpass', category: 'health', expiresOn: '2026-09-20' }),
        doc({ title: 'Handy', endDate: '2026-12-31', noticeDays: 90 }),
        doc({ title: 'Strom', endDate: '2026-10-20', noticeDays: 30 }),
      ],
      TODAY,
    );
    expect(rows.map((r) => [r.doc.title, r.date, r.kind, r.state])).toEqual([
      ['Impfpass', '2026-09-20', 'end', 'expired'],
      ['Handy', '2026-10-02', 'cancel', 'act-now'],
      // The deadline (20 Sep) has passed: what matters next is the end.
      ['Strom', '2026-10-20', 'end', 'missed'],
      ['Reisepass', '2026-11-06', 'end', 'soon'],
    ]);
  });

  it('counts documents per category', () => {
    expect(
      countByCategory([{ category: 'contract' }, { category: 'contract' }, { category: 'health' }]),
    ).toEqual({ contract: 2, health: 1 });
  });
});
