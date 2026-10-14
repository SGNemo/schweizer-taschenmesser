import { expect, type Locator, type Page } from '@playwright/test';

export const NAV = 'Hauptnavigation';

export function mainNav(page: Page) {
  // Sidebar (desktop) and bottom bar (mobile) share the label; only the visible one is matched.
  return page.getByRole('navigation', { name: NAV });
}

const handled = new WeakSet<Page>();

/**
 * The one-time third-party notices ("Verstanden", core/legal/notices.ts) would block the flow they belong to;
 * the handler clicks them away whenever one shows up. Specs about the notices themselves use `page.goto` directly.
 */
export async function dismissNotices(page: Page) {
  if (handled.has(page)) return;
  handled.add(page);
  await page.addLocatorHandler(page.getByTestId('notice-dialog'), async () => {
    await page.getByRole('button', { name: 'Verstanden' }).click();
  });
}

/** Opens `url` and waits for the page title, i.e. the app has booted and the route rendered. */
export async function ready(page: Page, url: string) {
  await dismissNotices(page);
  await page.goto(url);
  await expect(page.locator('main h1')).toBeVisible();
}

/** The on/off switch of a module card in the library (`/library`). */
export const moduleSwitch = (card: Locator) => card.getByRole('switch', { name: /einschalten/ });

/** Switches a module on in the library and waits for its "Aktiv" badge. */
export async function enable(page: Page, id: string) {
  await page.goto('/library');
  const card = page.getByTestId(`module-${id}`);
  const toggle = moduleSwitch(card);
  await expect(toggle).toBeEnabled(); // disabled until the module states have loaded
  if (!(await toggle.isChecked())) await toggle.click(); // core modules are on already
  await expect(card.getByText('Aktiv', { exact: true })).toBeVisible();
}

export const enableExample = (page: Page) => enable(page, 'example');

/**
 * A calendar entry in the main content, not the agenda side panel that sits next to it from
 * 1200 px (the same entry would otherwise match twice).
 */
export function calendarEntry(page: Page, name: RegExp) {
  return page.getByRole('button', { name }).and(page.locator('xpath=//*[not(ancestor::aside)]'));
}

/** Opens the rarely used fields of the open dialog ("Mehr Felder"); a no-op in the Erweitert view or when they hold data. */
export async function moreFields(page: Page) {
  const button = page.getByRole('dialog').getByRole('button', { name: 'Weitere Felder anzeigen' });
  if (await button.count()) await button.click();
}

/**
 * Specs written before the calm defaults (focus audit 2) expect the full home screen: shows every
 * widget on this device. A fresh app now starts with "Nur das Wichtigste".
 */
export async function showAllWidgets(page: Page) {
  await page.addInitScript(() => localStorage.setItem('tm-home-view', 'all'));
}

/** Opens the folded "Weitere Einstellungen" block of Fokus & Aufmerksamkeit (once the page is loaded). */
export async function openMoreFocus(page: Page) {
  const more = page.getByTestId('focus-more');
  if ((await more.getAttribute('open')) === null) await more.locator('summary').click();
}
