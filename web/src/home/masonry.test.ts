import { describe, expect, it } from 'vitest';
import { packedRows } from './masonry';

describe('packed overview grid (U19)', () => {
  it('spans a card over its own height plus the gap below, in 1 px rows', () => {
    expect(packedRows(200, 24)).toBe(224);
    expect(packedRows(312.4, 24)).toBe(337);
    expect(packedRows(0, 0)).toBe(1);
  });
});
