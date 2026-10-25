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

/**
 * A dialog, sheet or menu that just closed pops its Back entry asynchronously (`core/shell/backStack`,
 * marker `tmBack` in `history.state`). A navigation started in that gap is aborted by the late
 * traversal or lands on the entry below (`?new=1` dropped, the new dialog closed again), so wait
 * for the pop to settle first. Bounded: an element that is still open keeps its marker on purpose.
 */
async function backSettled(page: Page) {
  await page
    .waitForFunction(() => !(history.state && 'tmBack' in (history.state as object)), undefined, {
      timeout: 1500,
    })
    .catch(() => undefined);
}

/** Opens `url` and waits for the page title, i.e. the app has booted and the route rendered. */
export async function ready(page: Page, url: string) {
  await dismissNotices(page);
  await backSettled(page);
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
  const button = page.getByRole('dialog').getByRole('button', { name: 'Mehr Felder anzeigen' });
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

/**
 * Opens one folded group of a settings section (`FoldedGroup`, test id `<section>-group-<id>`):
 * Darstellung (`theme`, `colors`, `text`, `motion`, `other`), Lesen (`aid`), Fokus (`aids`), Favoriten (`list`).
 */
export async function openFoldedGroup(page: Page, section: string, id: string) {
  const group = page.getByTestId(`${section}-group-${id}`);
  if ((await group.getAttribute('open')) === null) await group.locator('summary').click();
  await expect(group).toHaveAttribute('open', '');
}

/** Opens one folded group of Einstellungen → Darstellung (`theme`, `colors`, `text`, `motion`, `other`). */
export async function openAppearanceGroup(
  page: Page,
  id: 'theme' | 'colors' | 'text' | 'motion' | 'other',
) {
  await openFoldedGroup(page, 'appearance', id);
}

/**
 * The "⋯" menu of the ToDos page (list filter, "Neue Liste", "Erweitert", "Mit KI eintragen"):
 * opens it and returns the menu. Pick an entry with `getByRole('menuitem' | 'menuitemcheckbox', …)`.
 */
export async function openTodosMenu(page: Page) {
  const menu = page.getByRole('menu', { name: 'Weitere Optionen' });
  if (!(await menu.isVisible()))
    await page.getByRole('button', { name: 'Weitere Optionen' }).click();
  await expect(menu).toBeVisible();
  return menu;
}

/** The "⋯" menu of the Merkliste page (status, type, tag filter, grouping, "Erweitert"): same pattern as the ToDos menu. */
export const openBookmarksMenu = openTodosMenu;

/** Shows one list of the ToDos page through the "⋯" menu ("Irgendwann", "Eingang", a list name). */
export async function pickTodosList(page: Page, name: string) {
  const menu = await openTodosMenu(page);
  await menu.getByRole('menuitemcheckbox', { name, exact: true }).click();
}
