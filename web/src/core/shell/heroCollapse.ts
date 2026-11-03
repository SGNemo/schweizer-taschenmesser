/**
 * The module head ("hero") shrinks to one line on the phone once the page is scrolled, and grows back near the top.
 * Pure decision with hysteresis (a pixel of jitter at the threshold must not flip it back and forth).
 */
export const HERO_COLLAPSE_AFTER_PX = 96;
export const HERO_EXPAND_BEFORE_PX = 24;

export function nextHeroCollapsed(i: { collapsed: boolean; y: number; phone: boolean }): boolean {
  if (!i.phone) return false;
  if (i.y >= HERO_COLLAPSE_AFTER_PX) return true;
  if (i.y <= HERO_EXPAND_BEFORE_PX) return false;
  return i.collapsed;
}
