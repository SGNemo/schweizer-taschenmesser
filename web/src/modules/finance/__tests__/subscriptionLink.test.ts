import { describe, expect, it } from 'vitest';
import { chargeAlreadyBooked, detectPriceChanges, payeeMatches } from '../subscriptionLink';

const sub = { id: 's1', name: 'Streaming Plus', amountMinor: 1299, currency: 'EUR' };
const acc = new Map([
  ['a1', 'EUR'],
  ['a2', 'USD'],
]);
const b = (date: string, amountMinor: number, payee = 'STREAMING PLUS 4711', over = {}) => ({
  accountId: 'a1',
  kind: 'expense' as const,
  amountMinor,
  date,
  payee,
  ...over,
});
const detect = (bookings: ReturnType<typeof b>[], subs = [sub], today = '2026-03-10') =>
  detectPriceChanges({ subscriptions: subs, bookings, accountCurrency: acc, today });

describe('payee matching', () => {
  it.each([
    ['STREAMING PLUS 4711', 'Streaming Plus', true],
    ['Streaming-Plus Abo', 'Streaming Plus', true],
    ['streamingplus', 'Streaming Plus', false],
    ['Streaming Plusminus', 'Streaming Plus', false],
    ['Café Rot', 'Cafe Rot', true],
    [undefined, 'X', false],
    ['anything', '', false],
  ])('%s vs %s → %s', (payee, name, ok) => expect(payeeMatches(payee, name)).toBe(ok));
});

describe('price change from bookings (expectation table)', () => {
  const rows: [string, ReturnType<typeof b>[], number | undefined][] = [
    ['two newest agree on a new price', [b('2026-02-05', 1499), b('2026-03-05', 1499)], 1499],
    [
      'same as the stored price: nothing',
      [b('2026-02-15', 1299), b('2026-03-01', 1299)],
      undefined,
    ],
    ['one booking only: nothing', [b('2026-03-01', 1499)], undefined],
    ['the two newest differ: nothing', [b('2026-02-01', 1499), b('2026-03-01', 1599)], undefined],
    [
      'an old different booking does not matter',
      [b('2026-01-01', 1299), b('2026-02-01', 1499), b('2026-03-01', 1499)],
      1499,
    ],
    [
      'older than the window (120 days) is history',
      [b('2025-10-01', 1499), b('2025-11-01', 1499)],
      undefined,
    ],
    [
      'other payee is not this subscription',
      [b('2026-02-01', 1499, 'Other'), b('2026-03-01', 1499, 'Other')],
      undefined,
    ],
    [
      'income is not a charge',
      [
        b('2026-02-01', 1499, undefined, { kind: 'income' }),
        b('2026-03-01', 1499, undefined, { kind: 'income' }),
      ],
      undefined,
    ],
    [
      'a transfer is not a charge',
      [
        b('2026-02-01', 1499, undefined, { transferId: 't' }),
        b('2026-03-01', 1499, undefined, { transferId: 't' }),
      ],
      undefined,
    ],
    [
      'other currency account',
      [
        b('2026-02-01', 1499, undefined, { accountId: 'a2' }),
        b('2026-03-01', 1499, undefined, { accountId: 'a2' }),
      ],
      undefined,
    ],
    [
      'future-dated bookings are ignored',
      [b('2026-04-01', 1499), b('2026-05-01', 1499)],
      undefined,
    ],
  ];
  it.each(rows)('%s', (_n, bookings, toMinor) => {
    const found = detect(bookings);
    expect(found.map((c) => c.toMinor)).toEqual(toMinor === undefined ? [] : [toMinor]);
  });

  it('names the stored and the new price and when it was first seen', () => {
    expect(detect([b('2026-02-15', 1499), b('2026-03-15', 1499)], [sub], '2026-03-20')[0]).toEqual({
      subscriptionId: 's1',
      name: 'Streaming Plus',
      fromMinor: 1299,
      toMinor: 1499,
      since: '2026-02-15',
      currency: 'EUR',
    });
  });
});

describe('charge already booked', () => {
  const charge = { name: 'Streaming Plus', amountMinor: 1299, date: '2026-03-15' };
  it.each([
    ['same day', b('2026-03-15', 1299), true],
    ['two days off', b('2026-03-17', 1299), true],
    ['three days off', b('2026-03-12', 1299), true],
    ['four days off', b('2026-03-11', 1299), false],
    ['other amount', b('2026-03-15', 1300), false],
    ['other payee', b('2026-03-15', 1299, 'Other'), false],
  ])('%s → %s', (_n, booking, ok) => expect(chargeAlreadyBooked(charge, [booking])).toBe(ok));
});
