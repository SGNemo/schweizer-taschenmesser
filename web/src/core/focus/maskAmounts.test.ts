import { describe, expect, it } from 'vitest';
import { HIDDEN_AMOUNT, maskAmounts } from './maskAmounts';

describe('maskAmounts', () => {
  it('replaces every amount in a line and keeps the words', () => {
    expect(maskAmounts('Stadtwerke · 87,40 €')).toBe(`Stadtwerke · ${HIDDEN_AMOUNT}`);
    expect(maskAmounts('noch 1.017,84 € offen · 2 überfällig')).toBe(
      `noch ${HIDDEN_AMOUNT} offen · 2 überfällig`,
    );
    expect(maskAmounts('Netflix kostet jetzt CHF 14.99 statt CHF 12.99')).toBe(
      `Netflix kostet jetzt ${HIDDEN_AMOUNT} statt ${HIDDEN_AMOUNT}`,
    );
  });
  it('leaves counts, times and percentages alone', () => {
    const line = '2 Rechnungen heute fällig · 13:00 · 96 %';
    expect(maskAmounts(line)).toBe(line);
  });
});
