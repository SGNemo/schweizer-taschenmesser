import { expect, type Page } from '@playwright/test';

export const NAV = 'Hauptnavigation';

export function mainNav(page: Page) {
  // Sidebar (desktop) and bottom bar (mobile) share the label; only the visible one is matched.
  return page.getByRole('navigation', { name: NAV });
}

/** Opens `url` and waits for the page title, i.e. the app has booted and the route rendered. */
export async function ready(page: Page, url: string) {
  await page.goto(url);
  await expect(page.locator('main h1')).toBeVisible();
}

/** Switches a module on in the library and waits for its "Aktiv" badge. */
export async function enable(page: Page, id: string) {
  await page.goto('/library');
  const card = page.getByTestId(`module-${id}`);
  await card.getByRole('button', { name: 'Aktivieren' }).click();
  await expect(card.getByText('Aktiv', { exact: true })).toBeVisible();
}

export const enableExample = (page: Page) => enable(page, 'example');
