import { expect, test } from '@playwright/test';
import { ready } from './helpers';

/**
 * One-hand use on the phone (focus audit 2, package 3): on the main pages every button and link is
 * at least 44 px high and wide, except the controls that look smaller and carry a 44 px hit area on
 * purpose (icon and small buttons, switch tracks, chips, the segment strip, calendar day numbers).
 */
const PAGES = ['/', '/todos', '/finance', '/notes', '/pantry', '/bookmarks', '/calendar'];

test.describe('Touch targets on the phone', () => {
  test.skip(({ isMobile }) => !isMobile, 'a phone check');

  for (const url of PAGES) {
    test(`${url}: nothing below 44 px that is not a deliberate hit area`, async ({ page }) => {
      await ready(page, url);
      const small = await page.locator('button, a[href]').evaluateAll((els) =>
        els
          .map((el) => ({ el, r: el.getBoundingClientRect() }))
          .filter(
            ({ el, r }) =>
              r.width > 0 &&
              r.height > 0 &&
              (r.height < 44 || r.width < 44) &&
              !el.matches(
                '[class*="_icon_"], [class*="_sm_"], [class*="_track_"], [class*="_chip_"], [class*="_dayNum_"], [class*="_segment_"] button, [data-row]',
              ),
          )
          .map(
            ({ el, r }) =>
              `${el.textContent || el.getAttribute('aria-label')} ${Math.round(r.width)}x${Math.round(r.height)}`,
          ),
      );
      expect(small).toEqual([]);
    });
  }
});
