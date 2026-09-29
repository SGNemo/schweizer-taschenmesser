import { expect, type Page } from '@playwright/test';

export const NAV = 'Hauptnavigation';

export function mainNav(page: Page) {
  // Sidebar (desktop) and bottom bar (mobile) share the label; only the visible one is matched.
  return page.getByRole('navigation', { name: NAV });
}

export async function enableExample(page: Page) {
  await page.goto('/library');
  const card = page.getByTestId('module-example');
  await card.getByRole('button', { name: 'Aktivieren' }).click();
  await expect(card.getByText('Aktiv', { exact: true })).toBeVisible();
}
