import { describe, expect, it } from 'vitest';
import { HIDDEN_AMOUNT, maskAmounts } from './maskAmounts';

const H = HIDDEN_AMOUNT;

describe('maskAmounts', () => {
  it('replaces every amount in a line and keeps the words', () => {
    expect(maskAmounts('Stadtwerke · 87,40 €')).toBe(`Stadtwerke · ${H}`);
    expect(maskAmounts('noch 1.017,84 € offen · 2 überfällig')).toBe(
      `noch ${H} offen · 2 überfällig`,
    );
    expect(maskAmounts('Netflix kostet jetzt CHF 14.99 statt CHF 12.99')).toBe(
      `Netflix kostet jetzt ${H} statt ${H}`,
    );
  });
  it('takes amounts grouped by spaces whole, also with no-break spaces, and a code without a space', () => {
    expect(maskAmounts('noch 1 017,84 €')).toBe(`noch ${H}`);
    expect(maskAmounts('noch 1 017,84 €')).toBe(`noch ${H}`);
    expect(maskAmounts('Strom 54,30EUR überweisen')).toBe(`Strom ${H} überweisen`);
  });
  it('leaves counts, times and percentages alone, also a count right after an amount', () => {
    const line = '2 Rechnungen heute fällig · 13:00 · 96 %';
    expect(maskAmounts(line)).toBe(line);
    expect(maskAmounts('CHF 12.99 2 Abos')).toBe(`${H} 2 Abos`);
    expect(maskAmounts('CHF 12.99 200 Abos')).toBe(`${H} 200 Abos`);
    expect(maskAmounts('EUR12 und CHF12')).toBe(`${H} und ${H}`);
    expect(maskAmounts('Raum 12 Europa')).toBe('Raum 12 Europa');
  });
  it('reads a long digit run once (no slow backtracking on a strange title)', () => {
    const started = performance.now();
    maskAmounts('1'.repeat(20_000));
    expect(performance.now() - started).toBeLessThan(200);
  });
});
