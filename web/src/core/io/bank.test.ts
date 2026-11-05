// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest';
import { setFormatPref } from '@/core/i18n/format';
import { BankFormatError, bankDedupeKey, parseBankCsv, parseBankFile, parseCamt } from './bank';

// Invented data in the layout of the savings banks' "CSV-CAMT" export (semicolon, quotes, dd.MM.yy).
const HEADER =
  '"Auftragskonto";"Buchungstag";"Valutadatum";"Buchungstext";"Verwendungszweck";"Glaeubiger ID";"Mandatsreferenz";"Kundenreferenz (End-to-End)";"Sammlerreferenz";"Lastschrift Ursprungsbetrag";"Auslagenersatz Ruecklastschrift";"Beguenstigter/Zahlungspflichtiger";"Kontonummer/IBAN";"BIC (SWIFT-Code)";"Betrag";"Waehrung";"Info"';
const CSV = [
  HEADER,
  '"DE00123456780000000001";"03.09.26";"03.09.26";"LASTSCHRIFT";"Streaming Monatsbeitrag Sep";"";"";"";"";"";"";"Filmfreund GmbH";"DE00999999990000000002";"TESTDEFFXXX";"-9,99";"EUR";"Umsatz gebucht"',
  '"DE00123456780000000001";"01.09.26";"01.09.26";"GEHALT/RENTE";"Gehalt September";"";"";"";"";"";"";"Beispiel AG";"DE00999999990000000003";"TESTDEFFXXX";"2.345,67";"EUR";"Umsatz gebucht"',
  '"DE00123456780000000001";"kaputt";"";"";"";"";"";"";"";"";"";"";"";"";"12,00";"EUR";""',
].join('\r\n');

describe('parseBankCsv: payee column with real umlauts (QA B28)', () => {
  it.each([
    'Auftraggeber/Empfänger',
    'Empfänger',
    'Begünstigter/Zahlungspflichtiger',
    'Zahlungsempfänger',
  ])('reads the payee from "%s"', (name) => {
    const csv = `Buchungstag;Wertstellung;${name};Buchungstext;Verwendungszweck;Betrag;Währung\n05.10.2026;05.10.2026;Müller GmbH;Gutschrift;Rechnung 2026-041 Beratung Oktober;2.400,00;EUR\n`;
    const [tx] = parseBankCsv(csv).transactions;
    expect(tx).toMatchObject({
      payee: 'Müller GmbH',
      purpose: 'Rechnung 2026-041 Beratung Oktober',
    });
  });
});

describe('parseBankCsv', () => {
  it('reads dates, signed amounts, payee, purpose and own account', () => {
    const r = parseBankCsv(CSV);
    expect(r.format).toBe('csv');
    expect(r.skipped).toBe(1);
    expect(r.transactions).toEqual([
      {
        date: '2026-09-03',
        amountMinor: -999,
        currency: 'EUR',
        payee: 'Filmfreund GmbH',
        purpose: 'Streaming Monatsbeitrag Sep',
        accountIban: 'DE00123456780000000001',
      },
      {
        date: '2026-09-01',
        amountMinor: 234567,
        currency: 'EUR',
        payee: 'Beispiel AG',
        purpose: 'Gehalt September',
        accountIban: 'DE00123456780000000001',
      },
    ]);
  });

  it('accepts a byte order mark and other common column names', () => {
    const text =
      '﻿Buchungstag;Verwendungszweck;Name Zahlungsbeteiligter;Betrag;Währung\n05.10.2026;Miete;Vermieter Mustermann;-650,00;EUR';
    expect(parseBankCsv(text).transactions[0]).toMatchObject({
      date: '2026-10-05',
      amountMinor: -65000,
      payee: 'Vermieter Mustermann',
    });
  });

  it('rejects files without date and amount columns', () => {
    expect(() => parseBankCsv('a;b\n1;2')).toThrow(BankFormatError);
  });
});

const CAMT = `<?xml version="1.0" encoding="UTF-8"?>
<Document xmlns="urn:iso:std:iso:20022:tech:xsd:camt.053.001.02">
  <BkToCstmrStmt>
    <Stmt>
      <Acct><Id><IBAN>DE00123456780000000001</IBAN></Id></Acct>
      <Ntry>
        <Amt Ccy="EUR">9.99</Amt>
        <CdtDbtInd>DBIT</CdtDbtInd>
        <BookgDt><Dt>2026-09-03</Dt></BookgDt>
        <NtryDtls><TxDtls>
          <RltdPties><Cdtr><Nm>Filmfreund GmbH</Nm></Cdtr></RltdPties>
          <RmtInf><Ustrd>Streaming Monatsbeitrag</Ustrd><Ustrd>Sep</Ustrd></RmtInf>
        </TxDtls></NtryDtls>
      </Ntry>
      <Ntry>
        <Amt Ccy="EUR">2345.67</Amt>
        <CdtDbtInd>CRDT</CdtDbtInd>
        <BookgDt><Dt>2026-09-01</Dt></BookgDt>
        <NtryDtls><TxDtls>
          <RltdPties><Dbtr><Nm>Beispiel AG</Nm></Dbtr></RltdPties>
        </TxDtls></NtryDtls>
        <AddtlNtryInf>Gehalt</AddtlNtryInf>
      </Ntry>
      <Ntry><Amt Ccy="EUR">1.00</Amt><CdtDbtInd>DBIT</CdtDbtInd></Ntry>
    </Stmt>
  </BkToCstmrStmt>
</Document>`;

describe('parseCamt', () => {
  it('reads debits and credits with the right party and sign', () => {
    const r = parseCamt(CAMT);
    expect(r.format).toBe('camt');
    expect(r.skipped).toBe(1); // entry without a date
    expect(r.transactions).toEqual([
      {
        date: '2026-09-03',
        amountMinor: -999,
        currency: 'EUR',
        payee: 'Filmfreund GmbH',
        purpose: 'Streaming Monatsbeitrag Sep',
        accountIban: 'DE00123456780000000001',
      },
      {
        date: '2026-09-01',
        amountMinor: 234567,
        currency: 'EUR',
        payee: 'Beispiel AG',
        purpose: 'Gehalt',
        accountIban: 'DE00123456780000000001',
      },
    ]);
  });

  it('works for another camt version namespace and rejects non-CAMT XML', () => {
    expect(parseCamt(CAMT.replace('camt.053.001.02', 'camt.052.001.08')).transactions).toHaveLength(
      2,
    );
    expect(() => parseCamt('<a><b/></a>')).toThrow(BankFormatError);
    expect(() => parseCamt('<a>')).toThrow(BankFormatError);
  });

  describe('amounts always use "." as the decimal mark, whatever the format region (X23)', () => {
    const one = (amount: string) =>
      CAMT.replace('<Amt Ccy="EUR">9.99</Amt>', `<Amt Ccy="EUR">${amount}</Amt>`);
    afterEach(() => setFormatPref('auto'));

    it.each(['de-DE', 'en-US', 'de-CH'] as const)('in %s', (region) => {
      setFormatPref(region);
      const amountOf = (amount: string) => parseCamt(one(amount)).transactions[0]!.amountMinor;
      expect(amountOf('12.500')).toBe(-1250);
      expect(amountOf('12.50000')).toBe(-1250);
      expect(amountOf('12.5')).toBe(-1250);
      expect(amountOf('1234')).toBe(-123400);
      expect(amountOf('9.99')).toBe(-999);
    });

    it('skips an amount with a sub-cent part or a group mark', () => {
      setFormatPref('de-DE');
      for (const amount of ['12.505', '1,50', '1.234,56', '12.123456', '-5.00']) {
        const r = parseCamt(one(amount));
        expect(r.skipped, amount).toBe(2);
        expect(r.transactions, amount).toHaveLength(1);
      }
    });
  });
});

describe('parseBankFile / bankDedupeKey', () => {
  it('picks the parser from the content', () => {
    expect(parseBankFile(CSV).format).toBe('csv');
    expect(parseBankFile(CAMT).format).toBe('camt');
  });

  it('gives the same key for the same booking from either format', () => {
    const a = parseBankFile(CSV).transactions[0]!;
    const b = parseBankFile(CAMT).transactions[0]!;
    expect(bankDedupeKey(a)).toBe(bankDedupeKey(b));
  });
});
