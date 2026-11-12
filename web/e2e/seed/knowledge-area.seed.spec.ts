import { expect } from '@playwright/test';
import { measurePage, surfaceMetrics } from '../../scripts/lib/stimulusBudget';
import { mockSpotify, seedConnected } from '../spotify-mock';
import { test } from './helpers';
import { DESKTOP, openPage, PHONE, startSeeded } from './guards';
import { checkPlanPage, type PageRule } from './planArea';

/**
 * The knowledge area after package 0b-6 of UI audit 2026-11, first half (Merkliste, Notizen, Chat, Feeds, Mail, Musik):
 * the same reader as the plan area (`planArea.ts`: tone steps, content from y ≤ 220 px on the phone, tabs for the
 * views, one action in the head, nothing cut, rows 48 px on the phone and 44 px on the desktop).
 *
 * Musik is the area's stage (PACKAGES 0b-2 names the stage as an exception of "content from y ≤ 220 px"): without an
 * account it is checked with the others on the desktop, and with a mocked account for its surfaces and tabs in its own
 * test below. Mail exists in the desktop app only. The module library is no module page: its test below holds the
 * tone steps, the neutral switches and the two surface levels.
 *
 * `PLAN_SHOTS=<dir>` also writes a picture of every checked first screen (for the pull request).
 */
const PAGES: PageRule[] = [
  { path: '/bookmarks', colouredMax: 10, tabsMin: 2, figure: true, action: true },
  { path: '/bookmarks?view=links', colouredMax: 10, tabsMin: 2, figure: true, action: true },
  { path: '/notes', colouredMax: 10, tabsMin: 0, figure: false, action: true },
  // The seed has no AI provider: the set-up hint owns the filled button and "Neuer Chat" steps back (C23).
  { path: '/chat', colouredMax: 10, tabsMin: 0, figure: false, action: false },
  { path: '/feeds', colouredMax: 10, tabsMin: 0, figure: true, action: true },
];
const DESKTOP_ONLY: PageRule[] = [
  // The demo account cannot send, so its head holds no "Neue Mail"; the unread count is the head's figure.
  { path: '/mail', colouredMax: 10, tabsMin: 0, figure: true, action: false },
  { path: '/music', colouredMax: 10, tabsMin: 0, figure: false, action: false },
];

for (const theme of process.env.PLAN_SHOTS ? (['light', 'dark'] as const) : (['light'] as const)) {
  test.describe(`knowledge area on tone steps (Identity 4.0, package 0b-6), ${theme}`, () => {
    test.use({ colorScheme: theme });
    test.setTimeout(180_000);

    test.describe('desktop', () => {
      test.use({ viewport: DESKTOP, seeded: { scale: 'medium', desktop: true, preview: true } });
      test('six pages: no frames, one action, nothing cut', async ({ page }) => {
        await startSeeded(page);
        const seen: Record<string, unknown> = {};
        for (const rule of [...PAGES, ...DESKTOP_ONLY])
          seen[rule.path] = await checkPlanPage(page, rule, { phone: false, theme });
        console.log(`knowledge area desktop ${theme}: ${JSON.stringify(seen)}`);
      });
    });

    test.describe('phone', () => {
      test.use({
        viewport: PHONE,
        isMobile: true,
        hasTouch: true,
        seeded: { scale: 'medium', preview: true },
      });
      test('four pages: content from y ≤ 220 px, plus is the action, nothing cut', async ({
        page,
      }) => {
        await startSeeded(page, { phone: true });
        const seen: Record<string, unknown> = {};
        for (const rule of PAGES)
          seen[rule.path] = await checkPlanPage(page, rule, { phone: true, theme });
        console.log(`knowledge area phone ${theme}: ${JSON.stringify(seen)}`);
      });
    });
  });
}

test.describe('Musik with an account: tabs under the stage, covers and queue on tone steps', () => {
  for (const phone of [false, true]) {
    test.describe(phone ? 'phone' : 'desktop', () => {
      test.use(
        phone
          ? {
              viewport: PHONE,
              isMobile: true,
              hasTouch: true,
              seeded: { scale: 'medium', preview: true },
            }
          : { viewport: DESKTOP, seeded: { scale: 'medium', desktop: true, preview: true } },
      );
      test('no frames, no shadows, five tabs, stage ≤ 320 px, nothing sideways', async ({
        page,
      }) => {
        test.setTimeout(120_000);
        await startSeeded(page, { phone });
        await mockSpotify(page);
        await seedConnected(page, ['show', 'control', 'playlists', 'library', 'history']);
        await openPage(page, '/music');
        await expect(page.getByTestId('music-main')).toBeVisible();
        await page.waitForTimeout(800);
        const m = surfaceMetrics(await page.evaluate(measurePage));
        expect.soft(m.borders, 'framed elements in main').toBe(0);
        expect.soft(m.shadows, 'shadows in main').toBe(0);
        // The views are tabs under the stage; the stage itself keeps its 320 px with a song playing.
        const tabs = page.getByRole('navigation', { name: 'Ansichten' }).getByRole('button');
        await expect.soft(tabs).toHaveCount(5);
        const stage = await page
          .getByTestId('module-frame')
          .evaluate((el) => el.getBoundingClientRect().height);
        expect.soft(stage, 'height of the stage').toBeLessThanOrEqual(320);
        await expect.soft(tabs.first()).toHaveAttribute('aria-current', 'page');
        expect
          .soft(
            await page.evaluate(
              () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
            ),
            'sideways overflow',
          )
          .toBe(false);
        if (process.env.PLAN_SHOTS)
          await page.screenshot({
            path: `${process.env.PLAN_SHOTS}/${phone ? 'phone' : 'desktop'}-light-music-connected.png`,
          });
      });
    });
  }
});

test.describe('module library on tone steps', () => {
  for (const phone of [false, true]) {
    test.describe(phone ? 'phone' : 'desktop', () => {
      test.use(
        phone
          ? {
              viewport: PHONE,
              isMobile: true,
              hasTouch: true,
              seeded: { scale: 'medium', preview: true },
            }
          : { viewport: DESKTOP, seeded: { scale: 'medium', desktop: true, preview: true } },
      );
      test('no frames, neutral switches, a card is the only surface level', async ({ page }) => {
        test.setTimeout(120_000);
        await startSeeded(page, { phone });
        await openPage(page, '/library');
        const m = surfaceMetrics(await page.evaluate(measurePage));
        expect.soft(m.borders, 'framed elements in main').toBe(0);
        expect.soft(m.shadows, 'shadows in main').toBe(0);
        const read = await page.evaluate(() => {
          const clear = (c: string) => c === 'rgba(0, 0, 0, 0)' || c === 'transparent';
          const cards = Array.from(
            document.querySelectorAll<HTMLElement>('[data-testid^="module-"]'),
          );
          const switches = Array.from(document.querySelectorAll('main [role="switch"]'));
          // A surface between the page and the card would make the card a second level, a filled head a third.
          const nested = cards.filter((card) => {
            for (let el = card.parentElement; el && el.tagName !== 'MAIN'; el = el.parentElement)
              if (!clear(getComputedStyle(el).backgroundColor)) return true;
            return false;
          });
          const tintedHeads = cards.filter((card) => {
            const head = card.firstElementChild;
            return !!head && !clear(getComputedStyle(head).backgroundColor);
          });
          return {
            cards: cards.length,
            switches: switches.length,
            accent: switches.filter((s) => s.getAttribute('data-tone') !== 'neutral').length,
            nested: nested.length,
            tintedHeads: tintedHeads.length,
            sideways: document.documentElement.scrollWidth > document.documentElement.clientWidth,
          };
        });
        expect.soft(read.cards, 'module cards').toBeGreaterThan(15);
        expect.soft(read.switches, 'one switch per card').toBe(read.cards);
        expect.soft(read.accent, 'switches in the accent').toBe(0);
        expect.soft(read.nested, 'cards inside another surface').toBe(0);
        expect.soft(read.tintedHeads, 'cards with a filled head').toBe(0);
        expect.soft(read.sideways, 'sideways overflow').toBe(false);
        if (process.env.PLAN_SHOTS)
          await page.screenshot({
            path: `${process.env.PLAN_SHOTS}/${phone ? 'phone' : 'desktop'}-light-library.png`,
          });
      });
    });
  }
});
