import { describe, expect, it } from 'vitest';
import { cornerGap } from './collision';

describe('overview edit mode: keyboard collision', () => {
  const wide = { left: 0, top: 0, width: 966, height: 138 };
  const own = { left: 0, top: 162, width: 471, height: 172 };
  it('a card moved onto the top-left of a wider card matches it, not its own place', () => {
    const moved = { left: 0, top: 0, width: 471, height: 172 };
    expect(cornerGap(moved, wide)).toBe(0);
    expect(cornerGap(moved, own)).toBeGreaterThan(100);
  });
  it('a corner on the right or bottom counts too (moves after the card)', () => {
    const moved = { left: 495, top: 0, width: 471, height: 138 };
    expect(cornerGap(moved, wide)).toBe(0);
  });
});
