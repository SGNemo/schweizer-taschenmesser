// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { firstScreenLoading, packedRows, SETTLE_CAP_MS } from './masonry';

describe('packed overview grid (U19)', () => {
  it('spans a card over its own height plus the gap below, in 1 px rows', () => {
    expect(packedRows(200, 24)).toBe(224);
    expect(packedRows(312.4, 24)).toBe(337);
    expect(packedRows(0, 0)).toBe(1);
  });
});

describe('first load: the cards of the first screen appear together', () => {
  const card = (top: number, loading: boolean) => {
    const el = document.createElement('div');
    if (loading) el.innerHTML = '<span class="sk"></span>';
    el.getBoundingClientRect = () => ({ top }) as DOMRect;
    return el;
  };
  it('waits while a card above the fold still shows a skeleton', () => {
    expect(firstScreenLoading([card(100, false), card(400, true)], 900, '.sk')).toBe(true);
  });
  it('does not wait for cards below the fold, and not once all above it have loaded', () => {
    expect(firstScreenLoading([card(100, false), card(1200, true)], 900, '.sk')).toBe(false);
    expect(firstScreenLoading([], 900, '.sk')).toBe(false);
  });
  it('has a cap, so a card that never loads cannot hide the others', () => {
    expect(SETTLE_CAP_MS).toBeGreaterThan(0);
    expect(SETTLE_CAP_MS).toBeLessThanOrEqual(2000);
  });
});
