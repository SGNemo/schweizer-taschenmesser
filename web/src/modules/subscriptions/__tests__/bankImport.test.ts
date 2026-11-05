import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { decodeTextBytes } from '@/core/io/pickFile';
import runtime from '../importer';

const read = (name: string) =>
  decodeTextBytes(
    readFileSync(new URL(`../../../core/io/__fixtures__/bank/${name}`, import.meta.url)),
  );

/** The fixture with its 9,99 € debit (October) repeated in August and September. */
function threeCharges(name: string): string {
  const lines = read(name).split(/\r?\n/);
  const i = lines.findIndex((l) => l.includes('Filmfreund'));
  const month = (m: string) =>
    lines[i]!.replace(/\.10\.(20)?26/g, `.${m}.$126`).replace(/2026-10-/g, `2026-${m}-`);
  lines.splice(i + 1, 0, month('09'), month('08'));
  return lines.join('\n');
}

describe('subscriptions from a bank statement use the bank layouts (X22)', () => {
  it.each([
    'ing.csv',
    'comdirect.csv',
    'n26.csv',
    'n26-de.csv',
    'dkb-alt.csv',
    'dkb-neu.csv',
    'sparkasse-camt.csv',
    'sparkasse-mt940.csv',
    'volksbank.csv',
  ])('%s: finds the monthly 9,99 € charge', async (file) => {
    const result = await runtime.parse(
      'bank',
      { kind: 'file', text: threeCharges(file), fileName: file },
      { today: '2026-11-05', options: {}, batchId: 'b1' },
    );
    expect(result.notes).toEqual([]);
    expect(result.candidates).toHaveLength(1);
    expect(result.candidates[0]!.data).toMatchObject({
      name: 'Filmfreund GmbH',
      amountMinor: 999,
      startDate: '2026-11-03',
    });
  });
});
