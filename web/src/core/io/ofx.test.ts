import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseOfx } from './ofx';
import { parseQif } from './qif';
import { parseLooseAmount } from './amount';
import { parseBankFile } from './bank';

const fixture = (name: string) =>
  readFileSync(new URL(`./__fixtures__/bank/${name}`, import.meta.url), 'utf8');

describe('parseLooseAmount', () => {
  it.each([
    ['-9,99', -999],
    ['-9.99', -999],
    ['2.345,67', 234567],
    ['1,234.56', 123456],
    ['1.234', 123400],
    ['12,5', 1250],
    ['0.123', 12], // not a thousands group: too many digits after a leading zero is invalid
    ['12,50-', -1250],
    ['(5,00)', -500],
    ['+7', 700],
  ])('reads %s', (input, cents) => {
    const got = parseLooseAmount(input);
    if (input === '0.123') expect(got).toBeUndefined();
    else expect(got).toBe(cents);
  });
  it('rejects text', () => {
    expect(parseLooseAmount('abc')).toBeUndefined();
    expect(parseLooseAmount('')).toBeUndefined();
  });
});

describe('parseOfx (SGML)', () => {
  const r = parseOfx(fixture('sample-sgml.ofx'));
  it('reads dates, cents, umlauts, entities, comma and dot amounts', () => {
    expect(r.format).toBe('ofx');
    expect(r.transactions[0]).toEqual({
      date: '2026-10-03',
      amountMinor: -999,
      currency: 'EUR',
      payee: 'Filmfreund GmbH',
      purpose: 'Streaming Monatsbeitrag Oktober',
      accountIban: 'DE00100000000000000001',
      fitId: '2026100301',
    });
    expect(r.transactions[1]).toMatchObject({
      date: '2026-10-01',
      amountMinor: 234567,
      payee: 'Müller & Söhne AG',
    });
  });
  it('keeps two bookings of one day, drops a repeated FITID, counts the unreadable one', () => {
    const coffees = r.transactions.filter((t) => t.payee.startsWith('Bäckerei'));
    expect(coffees).toHaveLength(2); // 2026100501, 2026100502; the second 2026100502 is the same booking
    expect(r.skipped).toBe(1);
  });
});

describe('parseOfx (XML)', () => {
  it('takes the currency from CURDEF and decodes entities', () => {
    const r = parseOfx(fixture('sample-xml.ofx'));
    expect(r.transactions).toHaveLength(2);
    expect(r.transactions[0]).toMatchObject({
      currency: 'USD',
      amountMinor: -125000,
      payee: 'Landlord & Co.',
      accountIban: '0000111122',
    });
    expect(r.transactions[1]!.amountMinor).toBe(300050);
  });
});

describe('parseQif', () => {
  it('reads German dates and decimal commas, skips the broken record', () => {
    const r = parseQif(fixture('sample-de.qif'));
    expect(r.format).toBe('qif');
    expect(r.skipped).toBe(1);
    expect(r.transactions.map((t) => [t.date, t.amountMinor, t.payee])).toEqual([
      ['2026-10-03', -999, 'Filmfreund GmbH'],
      ['2026-10-01', 234567, 'Müller & Söhne AG'],
      ['2026-10-05', -320, 'Bäckerei Kaffeeklatsch'],
      ['2026-10-05', -320, 'Bäckerei Kaffeeklatsch'],
    ]);
  });
  it("reads MM/DD'YY, MM/DD/YYYY and ISO dates, ignores !Account blocks", () => {
    const r = parseQif(fixture('sample-us.qif'));
    expect(r.skipped).toBe(0);
    expect(r.transactions.map((t) => [t.date, t.amountMinor])).toEqual([
      ['2026-10-03', -125000],
      ['2026-10-15', 300050],
      ['2026-10-20', -4510],
    ]);
  });
  it('reads day-first slash dates when the file proves it', () => {
    const r = parseQif('!Type:Bank\nD25/12/2026\nT-5,00\nPA\n^\nD03/04/2026\nT-1,00\nPB\n^\n');
    expect(r.transactions.map((t) => t.date)).toEqual(['2026-12-25', '2026-04-03']);
  });
});

describe('parseBankFile format detection', () => {
  it('recognises XML-OFX before CAMT, and SGML-OFX and QIF by content', () => {
    expect(parseBankFile(fixture('sample-xml.ofx')).format).toBe('ofx');
    expect(parseBankFile(fixture('sample-sgml.ofx')).format).toBe('ofx');
    expect(parseBankFile(fixture('sample-de.qif')).format).toBe('qif');
  });
});
