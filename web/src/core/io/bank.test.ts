// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
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
