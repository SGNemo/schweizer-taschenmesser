import { expect, type Locator, type Page } from '@playwright/test';

/**
 * The settings search field. On the phone it is an icon in the title line and opens on a tap (0b-E); on the desktop
 * it heads the category column. Opens it where needed and returns the field.
 */
export async function settingsSearch(page: Page): Promise<Locator> {
  const box = page.getByRole('searchbox', { name: 'Einstellungen durchsuchen' });
  const toggle = page.getByTestId('settings-search-toggle');
  await expect(box.or(toggle).first()).toBeVisible();
  if (!(await box.isVisible())) {
    await toggle.click();
    // The tap puts the cursor in the field.
    await expect(box).toBeFocused();
  }
  return box;
}
