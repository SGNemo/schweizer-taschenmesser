import { describe, expect, it } from 'vitest';
import { nextCollapsed, type CollapseInput } from './topbarCollapse';

const base: CollapseInput = {
  collapsed: false,
  y: 200,
  prevY: 150,
  focusInside: false,
  overlayOpen: false,
  keyboard: false,
  phone: true,
  reducedMotion: false,
};
const next = (o: Partial<CollapseInput>) => nextCollapsed({ ...base, ...o });

describe('topbar collapse', () => {
  it('folds when scrolling down past 48 px', () => {
    expect(next({})).toBe(true);
  });
  it('stays out near the top, whatever the direction', () => {
    expect(next({ y: 48, prevY: 20 })).toBe(false);
    expect(next({ y: 49, prevY: 20 })).toBe(true);
    expect(next({ collapsed: true, y: 0, prevY: 100 })).toBe(false);
  });
  it('comes back when scrolling up', () => {
    expect(next({ collapsed: true, y: 150, prevY: 200 })).toBe(false);
  });
  it('ignores jitter', () => {
    expect(next({ collapsed: true, y: 201, prevY: 200 })).toBe(true);
    expect(next({ collapsed: false, y: 201, prevY: 200 })).toBe(false);
  });
  it('stays out with keyboard focus in the bar, an open overlay or the on-screen keyboard', () => {
    expect(next({ focusInside: true })).toBe(false);
    expect(next({ overlayOpen: true })).toBe(false);
    expect(next({ keyboard: true })).toBe(false);
  });
  it('never moves with less motion or on the desktop', () => {
    expect(next({ reducedMotion: true, collapsed: true })).toBe(false);
    expect(next({ phone: false, collapsed: true })).toBe(false);
  });
});
