import { describe, expect, it } from 'vitest';
import type { BankTransaction } from './bank';
import { detectSubscriptions, payeeKey } from './subscriptionDetect';

const tx = (date: string, amountMinor: number, payee: string): BankTransaction => ({
  date,
  amountMinor,
  currency: 'EUR',
  payee,
  purpose: '',
});

describe('payeeKey', () => {
  it('drops digits, legal forms and punctuation', () => {
    expect(payeeKey('FILMFREUND GmbH 4711')).toBe('filmfreund');
    expect(payeeKey('Musik-Dienst.com  LU')).toBe('musik dienst.com');
  });
});

describe('detectSubscriptions', () => {
  it('finds a monthly charge with a stable amount', () => {
    const found = detectSubscriptions([
      tx('2026-06-03', -999, 'Filmfreund GmbH'),
      tx('2026-07-03', -999, 'Filmfreund GmbH'),
      tx('2026-08-04', -999, 'Filmfreund GmbH'),
      tx('2026-09-03', -999, 'Filmfreund GmbH'),
      tx('2026-09-10', -4250, 'Supermarkt Muster'),
    ]);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({
      payee: 'Filmfreund GmbH',
      amountMinor: 999,
      freq: 'monthly',
      lastDate: '2026-09-03',
      occurrences: 4,
    });
    expect(found[0]!.nextDate).toBe('2026-10-03');
  });

  it('finds yearly and weekly rhythms', () => {
    const yearly = detectSubscriptions([
      tx('2024-03-01', -4999, 'Versicherung Beispiel AG'),
      tx('2025-03-01', -4999, 'Versicherung Beispiel AG'),
      tx('2026-03-02', -4999, 'Versicherung Beispiel AG'),
    ]);
    expect(yearly[0]?.freq).toBe('yearly');
    const weekly = detectSubscriptions(
      ['2026-09-01', '2026-09-08', '2026-09-15', '2026-09-22'].map((d) =>
        tx(d, -500, 'Zeitung Wochenpost'),
      ),
    );
    expect(weekly[0]?.freq).toBe('weekly');
  });

  it('ignores fewer than three charges, irregular gaps and varying amounts', () => {
    expect(
      detectSubscriptions([tx('2026-08-03', -999, 'A Dienst'), tx('2026-09-03', -999, 'A Dienst')]),
    ).toEqual([]);
    expect(
      detectSubscriptions([
        tx('2026-06-03', -999, 'Tankstelle Muster'),
        tx('2026-06-20', -999, 'Tankstelle Muster'),
        tx('2026-09-30', -999, 'Tankstelle Muster'),
      ]),
    ).toEqual([]);
    expect(
      detectSubscriptions([
        tx('2026-07-03', -1200, 'Stromversorger Muster'),
        tx('2026-08-03', -3300, 'Stromversorger Muster'),
        tx('2026-09-03', -2100, 'Stromversorger Muster'),
      ]),
    ).toEqual([]);
  });

  it('ignores income', () => {
    expect(
      detectSubscriptions([
        tx('2026-07-01', 200000, 'Beispiel AG'),
        tx('2026-08-01', 200000, 'Beispiel AG'),
        tx('2026-09-01', 200000, 'Beispiel AG'),
      ]),
    ).toEqual([]);
  });
});
