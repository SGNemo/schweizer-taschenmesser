import { describe, expect, it } from 'vitest';
import { HERO_COLLAPSE_AFTER_PX, HERO_EXPAND_BEFORE_PX, nextHeroCollapsed } from './heroCollapse';

describe('module head collapse (phone)', () => {
  it('stays full at the top, collapses after the threshold, grows back near the top', () => {
    expect(nextHeroCollapsed({ collapsed: false, y: 0, phone: true })).toBe(false);
    expect(nextHeroCollapsed({ collapsed: false, y: HERO_COLLAPSE_AFTER_PX, phone: true })).toBe(
      true,
    );
    expect(nextHeroCollapsed({ collapsed: true, y: HERO_EXPAND_BEFORE_PX, phone: true })).toBe(
      false,
    );
  });

  it('hysteresis: between the thresholds the state is kept', () => {
    const mid = (HERO_COLLAPSE_AFTER_PX + HERO_EXPAND_BEFORE_PX) / 2;
    expect(nextHeroCollapsed({ collapsed: true, y: mid, phone: true })).toBe(true);
    expect(nextHeroCollapsed({ collapsed: false, y: mid, phone: true })).toBe(false);
  });

  it('never collapses on the desktop', () => {
    expect(nextHeroCollapsed({ collapsed: true, y: 500, phone: false })).toBe(false);
  });
});
