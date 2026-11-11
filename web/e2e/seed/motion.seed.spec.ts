import { expect, type Page } from '@playwright/test';
import { test } from './helpers';
import { openPage, PHONE, startSeeded } from './guards';

/**
 * Motion of the frame (UI audit 2026-11, package 0a-1b): the top bar that slides away while reading and the page
 * head move with `transform` and `opacity` only (no layout property), and with "reduce motion" the bar does not
 * slide at all. `e2e/layout.spec.ts` checks only that the bar stays; this pins what may move and how.
 */
const ALLOWED = new Set(['transform', 'opacity', 'none']);

/** Transition properties of the bar and the page head that really run (longer than a millisecond). */
const moving = (page: Page) =>
  page.evaluate(() => {
    const roots = [
      document.querySelector('header'),
      document.querySelector('main [data-head]'),
      // Identity 4.0: the head itself stays at the top (sticky); its tabs are the part that remains on the phone.
      document.querySelector('main [data-head] [data-slot="tabs"]'),
    ];
    const out = new Set<string>();
    for (const root of roots) {
      // Positive control: a part that is not found would pass unseen.
      if (!root) return ['missing part of the frame'];
      const s = getComputedStyle(root);
      const durations = s.transitionDuration.split(',').map((d) => parseFloat(d));
      s.transitionProperty.split(',').forEach((p, i) => {
        // "Reduce motion" sets every duration to a hundredth of a millisecond: that is no motion.
        if ((durations[i % durations.length] ?? 0) > 0.001) out.add(p.trim());
      });
    }
    return [...out];
  });

test.use({
  viewport: PHONE,
  isMobile: true,
  hasTouch: true,
  seeded: { scale: 'small', preview: true },
});

test('the top bar and the page head move with transform and opacity only', async ({ page }) => {
  await startSeeded(page, { phone: true });
  for (const path of ['/todos', '/calendar', '/finance']) {
    await openPage(page, path);
    const props = await moving(page);
    expect(
      props.filter((p) => !ALLOWED.has(p)),
      `${path}: ${props.join(', ')}`,
    ).toEqual([]);
  }
});

test.describe('with less motion', () => {
  test.use({ reducedMotion: 'reduce' });
  test('nothing in the frame runs a transition', async ({ page }) => {
    await startSeeded(page, { phone: true });
    await openPage(page, '/todos');
    expect(await moving(page)).toEqual([]);
  });
});
