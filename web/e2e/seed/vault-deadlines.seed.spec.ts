import AxeBuilder from '@axe-core/playwright';
import { join } from 'node:path';
import { expect, type Page } from '@playwright/test';
import { test } from './helpers';
import { DESKTOP, openPage, PHONE, startSeeded } from './guards';

/**
 * Unterlagen, view "Fristen" (module package T-a of UI audit 2026-11): every dated document of the test data lies
 * on one rail, what has run out above "Heute" in the warning tone (never red), what comes below it. The head's
 * views carry no counts. "Verlängert" proposes one more term and writes only after the confirmation. And the
 * promise C04 holds: no title of a document ever shows on the overview.
 *
 * `TA_SHOTS=<dir>` also writes a picture of the view (for the pull request).
 */
const SHOTS = process.env.TA_SHOTS;
/** Papers of the test data that only Unterlagen holds (`modules/vault/seed.ts`). */
const PAPERS = ['Reisepass', 'Personalausweis', 'Impfpass', 'Führerschein'] as const;

async function violations(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  return results.violations.map((v) => `${v.id}: ${v.nodes[0]?.target.join(' ')}`);
}

async function openDeadlines(page: Page) {
  await openPage(page, '/vault');
  const views = page.getByRole('navigation', { name: 'Ansichten' });
  // No counter on a view (FOCUS checklist 9): the labels are the two words.
  await expect(views.getByRole('button')).toHaveText(['Ablage', 'Fristen']);
  await views.getByRole('button', { name: 'Fristen' }).click();
  const rail = page.getByTestId('vault-timeline');
  await expect(rail).toBeVisible();
  return rail;
}

/** Rows above and below the "Heute" marker, and how the expired ones are marked. Runs in the page. */
function readRail() {
  const items = Array.from(document.querySelectorAll('[data-testid="vault-timeline"] ol > li'));
  const marker = items.findIndex((li) => li.textContent?.trim() === 'Heute');
  const title = (li: Element) => li.querySelector('button')?.textContent?.trim() ?? '';
  const past = items.slice(0, marker);
  return {
    marker,
    past: past.map(title),
    ahead: items.slice(marker + 1).map(title),
    pastBadges: past.map((li) => {
      // The innermost element that says it: the badge itself, not the tag around it.
      const badge = Array.from(li.querySelectorAll('span'))
        .reverse()
        .find((s) => s.textContent?.trim() === 'Abgelaufen');
      return badge ? badge.className : '';
    }),
    sideways: document.documentElement.scrollWidth > document.documentElement.clientWidth,
  };
}

async function check(page: Page, phone: boolean, theme: string) {
  await startSeeded(page, { phone });
  await openDeadlines(page);
  const seen = await page.evaluate(readRail);
  console.log(`vault deadlines ${phone ? 'phone' : 'desktop'}: ${JSON.stringify(seen)}`);
  // The test data: three documents have run out, six and more lie ahead.
  expect(seen.marker).toBeGreaterThanOrEqual(0);
  expect(seen.past.length).toBeGreaterThanOrEqual(3);
  expect(seen.ahead.length).toBeGreaterThanOrEqual(6);
  // What has run out says so on a badge in the warning tone: red stays for overdue money.
  for (const cls of seen.pastBadges) {
    expect(cls).toMatch(/warning/);
    expect(cls).not.toMatch(/danger/);
  }
  expect(seen.sideways).toBe(false);
  expect(await violations(page), 'axe: view "Fristen"').toEqual([]);
  if (SHOTS)
    await page.screenshot({
      path: join(SHOTS, `fristen-${phone ? 'phone' : 'desktop'}-${theme}.png`),
    });

  // Promise C04: the overview never shows a title of a document. Papers only Unterlagen holds are looked for on
  // the whole overview (a contract's name can also be a subscription or a booking of another module); inside the
  // module's own widget, where it is placed, no title at all may show.
  const titles = [...seen.past, ...seen.ahead].filter(Boolean);
  expect(titles.length).toBeGreaterThanOrEqual(9);
  for (const paper of PAPERS) expect(titles, paper).toContain(paper);
  await openPage(page, '/');
  const overview = (await page.locator('main').textContent()) ?? '';
  for (const paper of PAPERS) expect(overview, paper).not.toContain(paper);
  const widget = page.getByTestId('widget-vault:expiring');
  if (await widget.count()) {
    const text = (await widget.textContent()) ?? '';
    for (const title of titles) expect(text, title).not.toContain(title);
  }
}

for (const theme of ['light', 'dark'] as const) {
  test.describe(`Unterlagen: Fristen as a timeline (module package T-a), ${theme}`, () => {
    test.use({ colorScheme: theme });
    test.setTimeout(120_000);

    test.describe('desktop', () => {
      test.use({ viewport: DESKTOP, seeded: { scale: 'medium', desktop: true, preview: true } });
      test('past above "Heute" in the warning tone, the rest below; no title on the overview', async ({
        page,
      }) => {
        await check(page, false, theme);
      });

      test('"Verlängert" proposes one more term and writes only after the confirmation', async ({
        page,
      }) => {
        await startSeeded(page);
        const rail = await openDeadlines(page);
        const before = await page.evaluate(readRail);
        const renew = rail.getByRole('button', { name: /^Verlängert: / }).first();
        const name = (await renew.getAttribute('aria-label'))!.replace('Verlängert: ', '');
        await renew.click();
        const dialog = page.getByRole('dialog', { name: `Verlängert: ${name}` });
        await expect(dialog).toBeVisible();
        await expect(dialog.getByText(/^Bisher bis /)).toBeVisible();
        expect(await violations(page), 'axe: dialog "Verlängert"').toEqual([]);
        // Nothing is written yet: closing leaves the rail as it was.
        await dialog.getByRole('button', { name: 'Abbrechen' }).click();
        expect((await page.evaluate(readRail)).past).toEqual(before.past);
      });
    });

    test.describe('phone', () => {
      test.use({
        viewport: PHONE,
        isMobile: true,
        hasTouch: true,
        seeded: { scale: 'medium', preview: true },
      });
      test('the rail fits the phone: nothing runs out sideways', async ({ page }) => {
        await check(page, true, theme);
      });
    });
  });
}
