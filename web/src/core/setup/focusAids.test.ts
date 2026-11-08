import { describe, expect, it } from 'vitest';
import { DEFAULT_FOCUS } from '@/core/settings/focus';
import { CALM_KEYS, calmPreset, focusAidsPatch, focusAidsOf, type FocusAids } from './focusAids';

const off: FocusAids = {
  motion: false,
  ownReminders: false,
  noCounts: false,
  toastStay: false,
  readAid: false,
};

describe('setup step "Fokus-Hilfen"', () => {
  it('the calm preset switches the four calm aids on and leaves the reading aid as it is', () => {
    expect(calmPreset(off)).toEqual({
      ...off,
      motion: true,
      ownReminders: true,
      noCounts: true,
      toastStay: true,
    });
    expect(calmPreset({ ...off, readAid: true }).readAid).toBe(true);
    expect(CALM_KEYS).toEqual(['motion', 'ownReminders', 'noCounts', 'toastStay']);
  });

  it('reads the switches from the stored values', () => {
    const aids = focusAidsOf(
      { motion: 'system', toastStay: false, readAid: true },
      { ...DEFAULT_FOCUS, todoDigest: true, staggered: false, streaks: false, weekReview: false },
    );
    expect(aids).toEqual({
      motion: false,
      ownReminders: false,
      noCounts: true,
      toastStay: false,
      readAid: true,
    });
  });

  it('writes only what changed, and exactly the values the sentences promise', () => {
    const before = focusAidsOf(
      { motion: 'system', toastStay: false, readAid: false },
      { ...DEFAULT_FOCUS, todoDigest: true, staggered: true, streaks: true, weekReview: true },
    );
    const patch = focusAidsPatch(before, calmPreset(before));
    expect(patch.ui).toEqual({ motion: 'reduce', toastStay: true });
    expect(patch.focus).toEqual({
      todoDigest: false,
      staggered: false,
      streaks: false,
      weekReview: false,
    });
    expect(focusAidsPatch(before, before)).toEqual({ ui: {}, focus: {} });
  });

  it('switching an aid off turns on exactly what its sentence names', () => {
    const calm = calmPreset(off);
    const patch = focusAidsPatch(calm, {
      ...calm,
      motion: false,
      ownReminders: false,
      noCounts: false,
    });
    expect(patch.ui).toEqual({ motion: 'system' });
    expect(patch.focus).toEqual({ todoDigest: true, streaks: true, weekReview: true });
  });
});
