import { expect, type Locator, type Page } from '@playwright/test';

/**
 * Helpers for the money pages after package 0b-3 of UI audit 2026-11 (Finanzen, Rechnungen, Abos, Budgets).
 * Used by the money specs only; no guard spec imports this file.
 */

/**
 * Opens the dialog of a list entry. Finanzen ("Buchungen") and Rechnungen are master–detail: on a wide page a row
 * shows the entry in the detail panel and "Bearbeiten" there opens the dialog; below the split width (the phone) the
 * row opens the dialog itself. Works on both projects.
 */
export async function openEditor(page: Page, row: Locator) {
  await row.click();
  const dialog = page.getByRole('dialog');
  const edit = page.locator('[data-detail-panel]').getByRole('button', { name: 'Bearbeiten' });
  await expect(dialog.or(edit).first()).toBeVisible();
  if (!(await dialog.isVisible())) await edit.click();
  await expect(dialog).toBeVisible();
}

/** The page's "⋯" menu (the first "Weitere Aktionen" of the page; the rows' menus follow it). */
export async function openPageMenu(page: Page) {
  await page.getByRole('button', { name: 'Weitere Aktionen' }).first().click();
  const menu = page.getByRole('menu');
  await expect(menu).toBeVisible();
  return menu;
}

/** Switches "Mehr Felder anzeigen" of the page: an entry of the page's "⋯" menu, no switch in the head (rule 4). */
export async function togglePageMoreFields(page: Page) {
  const menu = await openPageMenu(page);
  await menu.getByRole('menuitemcheckbox', { name: 'Mehr Felder anzeigen' }).click();
}
