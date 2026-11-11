import { expect } from '@playwright/test';
import { test } from './helpers';
import { DESKTOP, openPage, PHONE, startSeeded } from './guards';
import { checkPlanPage, visibleFields, type PageRule } from './planArea';

/**
 * The plan area after package 0b-4 of UI audit 2026-11, first half (Kalender, ToDos): see `planArea.ts` for what a
 * page has to hold. The stimulus measurement reads only the entry route of a module, so the other tabs and views of
 * the two pages are listed here.
 *
 * Colour above the fold: ToDos holds the area's limit of ten. The calendar's month names every entry of a named
 * calendar by a mark in that calendar's colour (the colour is the calendar, always beside its title), so its limit is
 * its own and only says "not more than today"; every other mark, line and badge is neutral.
 */
const PAGES: PageRule[] = [
  { path: '/calendar', colouredMax: 22, tabsMin: 2, figure: false, action: true },
  { path: '/calendar?view=week', colouredMax: 22, tabsMin: 2, figure: false, action: true },
  { path: '/calendar?view=agenda', colouredMax: 22, tabsMin: 2, figure: false, action: true },
  { path: '/calendar?tab=reminders', colouredMax: 10, tabsMin: 2, figure: false, action: true },
  { path: '/todos', colouredMax: 10, tabsMin: 2, figure: true, action: true },
  { path: '/todos?view=today', colouredMax: 10, tabsMin: 2, figure: true, action: true },
  { path: '/todos?view=board', colouredMax: 10, tabsMin: 2, figure: true, action: true },
];

for (const theme of process.env.PLAN_SHOTS ? (['light', 'dark'] as const) : (['light'] as const)) {
  test.describe(`plan area on tone steps (Identity 4.0, package 0b-4), ${theme}`, () => {
    test.use({ colorScheme: theme });
    test.setTimeout(180_000);

    test.describe('desktop', () => {
      test.use({ viewport: DESKTOP, seeded: { scale: 'medium', desktop: true, preview: true } });
      test('Kalender and ToDos: no frames, tabs, one action, nothing cut', async ({ page }) => {
        await startSeeded(page);
        const seen: Record<string, unknown> = {};
        for (const rule of PAGES)
          seen[rule.path] = await checkPlanPage(page, rule, { phone: false, theme });
        console.log(`plan area desktop ${theme}: ${JSON.stringify(seen)}`);
      });
    });

    test.describe('phone', () => {
      test.use({
        viewport: PHONE,
        isMobile: true,
        hasTouch: true,
        seeded: { scale: 'medium', preview: true },
      });
      test('Kalender and ToDos: content from y ≤ 220 px, plus is the action, nothing cut', async ({
        page,
      }) => {
        await startSeeded(page, { phone: true });
        const seen: Record<string, unknown> = {};
        for (const rule of PAGES)
          seen[rule.path] = await checkPlanPage(page, rule, { phone: true, theme });
        console.log(`plan area phone ${theme}: ${JSON.stringify(seen)}`);
      });
    });
  });
}

/**
 * The two click paths of the package: "Aufgabe eintragen" and "Termin eintragen" are the head's action (or the plus)
 * + typing + Enter. The appointment dialog shows at most five fields, the rest is folded with its values named.
 */
test.describe('click paths: one click, a title, Enter', () => {
  test.describe('desktop', () => {
    test.use({ viewport: DESKTOP, seeded: { scale: 'small', desktop: true, preview: true } });

    test('"Neue Aufgabe" in the head, a title, Enter: the task is in the list', async ({
      page,
    }) => {
      await startSeeded(page);
      await openPage(page, '/todos');
      // The page has no field of its own any more: the head's action is the entry.
      await expect(page.locator('main form')).toHaveCount(0);
      // Click 1 of at most 2.
      await page.locator('[data-page-action]').click();
      const dialog = page.getByRole('dialog', { name: 'ToDo hinzufügen' });
      await expect(dialog).toBeVisible();
      expect(await visibleFields(page), 'visible fields of a new task').toBe(1);
      // The title has the focus: typing and Enter is all that is left.
      await page.keyboard.type('Wächter-Aufgabe 0b-4');
      await page.keyboard.press('Enter');
      await expect(dialog).toHaveCount(0);
      await expect(
        page.getByRole('listitem').filter({ hasText: 'Wächter-Aufgabe 0b-4' }).first(),
      ).toBeVisible();
    });

    test('"Neuer Termin" in the head, a title, Enter: the appointment is in the month', async ({
      page,
    }) => {
      await startSeeded(page);
      await openPage(page, '/calendar?view=day');
      await page.locator('[data-page-action]').click();
      const dialog = page.getByRole('dialog', { name: 'Neuer Termin' });
      await expect(dialog).toBeVisible();
      expect(await visibleFields(page), 'visible fields of a new appointment').toBeLessThanOrEqual(
        5,
      );
      // What the folded fields will save stands beside "Mehr Felder".
      await expect(dialog.getByTestId('more-fields-summary')).toContainText('Einmalig');
      await page.keyboard.type('Wächter-Termin 0b-4');
      await page.keyboard.press('Enter');
      await expect(dialog).toHaveCount(0);
      await expect(page.getByRole('button', { name: /Wächter-Termin 0b-4/ }).first()).toBeVisible();
    });
  });

  test.describe('phone', () => {
    test.use({
      viewport: PHONE,
      isMobile: true,
      hasTouch: true,
      seeded: { scale: 'small', preview: true },
    });

    test('the plus opens the task sheet; a title and Enter save it', async ({ page }) => {
      await startSeeded(page, { phone: true });
      await openPage(page, '/todos');
      await expect(page.getByTestId('bottom-plus')).toHaveAccessibleName('Aufgabe eintragen');
      await page.getByTestId('bottom-plus').tap();
      const dialog = page.getByRole('dialog', { name: 'ToDo hinzufügen' });
      await expect(dialog).toBeVisible();
      await dialog.getByLabel('Titel').fill('Wächter-Aufgabe am Handy');
      await page.keyboard.press('Enter');
      await expect(dialog).toHaveCount(0);
      await expect(
        page.getByRole('listitem').filter({ hasText: 'Wächter-Aufgabe am Handy' }).first(),
      ).toBeVisible();
    });

    test('"Auf heute" is the first entry of a task\'s menu', async ({ page }) => {
      await startSeeded(page, { phone: true });
      await openPage(page, '/todos');
      // The first task of the list waits since last week: not due today.
      await page.locator('main').getByRole('button', { name: 'Weitere Aktionen' }).first().tap();
      await expect(page.getByRole('menuitem').first()).toHaveText('Auf heute');
    });

    test('the plus opens the appointment sheet; its foot with "Speichern" stays on screen while the fields scroll', async ({
      page,
    }) => {
      await startSeeded(page, { phone: true });
      await openPage(page, '/calendar');
      await expect(page.getByTestId('bottom-plus')).toHaveAccessibleName('Termin eintragen');
      await page.getByTestId('bottom-plus').tap();
      const dialog = page.getByRole('dialog', { name: 'Neuer Termin' });
      await expect(dialog).toBeVisible();
      expect(await visibleFields(page), 'visible fields of a new appointment').toBeLessThanOrEqual(
        5,
      );
      // Every field open: the sheet is longer than the screen now.
      await dialog.getByRole('button', { name: 'Mehr Felder anzeigen' }).tap();
      await expect(dialog.getByRole('textbox', { name: 'Ort' })).toBeVisible();
      const foot = dialog.locator('[data-form-actions]');
      await expect(foot).toHaveCSS('position', 'sticky');
      const save = dialog.getByRole('button', { name: 'Speichern' });
      for (const top of [0, 9999]) {
        await dialog.evaluate((el, y) => el.scrollTo(0, y), top);
        const box = (await save.boundingBox())!;
        expect(box.y, `"Speichern" on screen at scroll ${top}`).toBeGreaterThan(0);
        expect(box.y + box.height, `"Speichern" on screen at scroll ${top}`).toBeLessThanOrEqual(
          PHONE.height,
        );
      }
    });
  });
});
