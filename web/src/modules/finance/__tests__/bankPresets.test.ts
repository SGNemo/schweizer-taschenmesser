import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { parseBankFile } from '@/core/io/bank';
import { decodeTextBytes } from '@/core/io/pickFile';
import { BANK_PRESETS, detectBankPreset } from '../bankPresets';

const bytes = (name: string) =>
  readFileSync(new URL(`../../../core/io/__fixtures__/bank/${name}`, import.meta.url));
const read = (name: string) => decodeTextBytes(bytes(name));

// Every fixture holds the same three invented bookings in the layout of one bank.
const CASES: [id: string, file: string, name: string][] = [
  ['sparkasse-camt', 'sparkasse-camt.csv', 'Sparkasse (CSV-CAMT)'],
  ['sparkasse-mt940', 'sparkasse-mt940.csv', 'Sparkasse (MT940-CSV)'],
  ['ing', 'ing.csv', 'ING'],
  ['dkb-alt', 'dkb-alt.csv', 'DKB (alt)'],
  ['dkb-neu', 'dkb-neu.csv', 'DKB'],
  ['n26', 'n26.csv', 'N26'],
  ['n26-de', 'n26-de.csv', 'N26'],
  ['comdirect', 'comdirect.csv', 'comdirect'],
  ['volksbank', 'volksbank.csv', 'Volksbank / GLS'],
];

describe('bank presets', () => {
  it('has one fixture per preset', () => {
    expect(CASES.map((c) => c[0]).sort()).toEqual(BANK_PRESETS.map((p) => p.id).sort());
  });

  it.each(CASES)('%s: recognised from the header and read correctly', (id, file, name) => {
    const text = read(file);
    const preset = detectBankPreset(text);
    expect(preset?.id).toBe(id);
    expect(preset?.name).toBe(name);
    const { transactions, format } = parseBankFile(text, { layout: preset!.layout });
    expect(format).toBe('csv');
    expect(transactions).toHaveLength(3);
    expect(transactions.map((t) => [t.date, t.amountMinor, t.payee])).toEqual([
      ['2026-10-03', -999, 'Filmfreund GmbH'],
      ['2026-10-01', 234567, 'Beispiel AG'],
      ['2026-10-02', -2340, 'Marktkauf Mustertal'],
    ]);
    expect(transactions[0]!.purpose).toContain('Streaming Monatsbeitrag Oktober');
    expect(transactions[1]!.purpose).toContain('Gehalt Oktober');
    expect(transactions.every((t) => t.currency === 'EUR')).toBe(true);
  });

  it('no preset is recognised for a layout nobody knows', () => {
    expect(detectBankPreset('Tag;Summe;Wer\n01.10.2026;1,00;X\n')).toBeUndefined();
  });

  it('DKB: takes the other party as payee and leaves unbooked rows out', () => {
    const r = parseBankFile(read('dkb-neu.csv'), {
      layout: detectBankPreset(read('dkb-neu.csv'))!.layout,
    });
    expect(r.skipped).toBe(1); // "Vorgemerkt"
  });

  it('comdirect: splits the booking text and drops the reference', () => {
    const [tx] = parseBankFile(read('comdirect.csv'), {
      layout: detectBankPreset(read('comdirect.csv'))!.layout,
    }).transactions;
    expect(tx).toMatchObject({
      payee: 'Filmfreund GmbH',
      purpose: 'Streaming Monatsbeitrag Oktober',
    });
  });

  it('reads Windows-1252 files (ING, comdirect) with their umlauts', () => {
    const raw = bytes('ing.csv');
    expect(new TextDecoder('utf-8').decode(raw)).toContain('�');
    expect(decodeTextBytes(raw)).toContain('Auftraggeber/Empfänger');
    // A UTF-8 file stays as it is.
    expect(decodeTextBytes(new TextEncoder().encode('Müller'))).toBe('Müller');
  });

  it('the generic reader finds the header below account info lines', () => {
    const text = `Konto;Girokonto\nZeitraum;Oktober\n\n${read('sparkasse-mt940.csv')}`;
    expect(parseBankFile(text).transactions).toHaveLength(3);
  });
});
