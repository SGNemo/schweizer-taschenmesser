import { expect, test, type Page } from '@playwright/test';
import { enable, moreFields, openBookmarksMenu, ready } from './helpers';

/** Deterministic "today": Tuesday 2026-09-29, 10:00 local time. */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
  // Links open in a new tab; nothing may actually leave the test machine.
  await page
    .context()
    .route(/^https:\/\/(?!localhost).*/, (route) => route.fulfill({ body: 'ok' }));
});

async function add(page: Page, title: string, url: string, tags = '', kind = '') {
  await ready(page, '/bookmarks?new=1');
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Titel').fill(title);
  if (url) await dialog.getByLabel('Adresse (Link)').fill(url);
  if (tags || kind) await moreFields(page);
  if (kind) await dialog.getByLabel('Art').selectOption({ label: kind });
  if (tags) await dialog.getByLabel('Tags').fill(tags);
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  await expect(dialog).toHaveCount(0);
}

const rowOf = (page: Page, title: string) =>
  page
    .getByRole('group', { name: 'Merkliste' })
    .getByRole('listitem')
    .filter({ has: page.getByText(title, { exact: true }) });

async function rowMenu(page: Page, title: string) {
  await rowOf(page, title).getByRole('button', { name: 'Weitere Aktionen' }).click();
  const menu = page.getByRole('menu', { name: 'Weitere Aktionen' });
  await expect(menu).toBeVisible();
  return menu;
}

test.describe('Calm Merkliste page (focus audit 2)', () => {
  test.beforeEach(async ({ page }) => {
    await enable(page, 'bookmarks');
    await add(page, 'Pasta Rezept', 'koch.de/pasta', 'Kochen, Rezept');
    await add(page, 'Dune', '', 'Film', 'Ansehen');
  });

  test('a row has one link (the title) and a menu; the title opens the address', async ({
    page,
  }) => {
    const row = rowOf(page, 'Pasta Rezept');
    await expect(row.getByRole('link')).toHaveCount(1);
    await expect(row.getByRole('link')).toHaveAttribute('rel', 'noreferrer noopener');
    await expect(row).toContainText('koch.de');
    await expect(row).toContainText('#Kochen · #Rezept'); // domain and tags as text
    await expect(row.getByRole('button', { name: 'Weitere Aktionen' })).toBeVisible();
    // No row anywhere carries more than one link (no separate "Link öffnen" icon any more).
    for (const item of await page
      .getByRole('group', { name: 'Merkliste' })
      .getByRole('listitem')
      .all())
      expect(await item.getByRole('link').count()).toBeLessThanOrEqual(1);

    const popup = page.context().waitForEvent('page');
    await row.getByRole('link', { name: /Pasta Rezept/ }).click();
    expect((await popup).url()).toBe('https://koch.de/pasta');
  });

  test('an entry without an address opens the editor from its title', async ({ page }) => {
    const row = rowOf(page, 'Dune');
    await expect(row.getByRole('link')).toHaveCount(0);
    await row.getByRole('button', { name: /^Dune/ }).click();
    await expect(page.getByRole('dialog').getByLabel('Titel')).toHaveValue('Dune');
  });

  test('edit through the row menu', async ({ page }) => {
    const menu = await rowMenu(page, 'Pasta Rezept');
    for (const name of ['Bearbeiten', 'Link kopieren', 'Duplizieren', 'Löschen'])
      await expect(menu.getByRole('menuitem', { name })).toBeVisible();
    await menu.getByRole('menuitem', { name: 'Bearbeiten' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel('Titel').fill('Pasta Rezept neu');
    await dialog.getByRole('button', { name: 'Speichern' }).click();
    await expect(dialog).toHaveCount(0);
    await expect(rowOf(page, 'Pasta Rezept neu')).toBeVisible();
  });

  test('delete through the row menu, with undo', async ({ page }) => {
    await (await rowMenu(page, 'Dune')).getByRole('menuitem', { name: 'Löschen' }).click();
    await expect(rowOf(page, 'Dune')).toHaveCount(0);
    await page.getByRole('button', { name: 'Rückgängig' }).click();
    await expect(rowOf(page, 'Dune')).toBeVisible();
  });

  test('tag filter from the row menu, named on the page, one tap takes it back', async ({
    page,
  }) => {
    const menu = await rowMenu(page, 'Pasta Rezept');
    await menu.getByRole('menuitem', { name: 'Kochen', exact: true }).click();
    await expect(page.getByTestId('bookmarks-filter')).toContainText('Gefiltert: #Kochen');
    await expect(rowOf(page, 'Pasta Rezept')).toBeVisible();
    await expect(rowOf(page, 'Dune')).toHaveCount(0);
    await page
      .getByTestId('bookmarks-filter')
      .getByRole('button', { name: 'Alle anzeigen' })
      .click();
    await expect(page.getByTestId('bookmarks-filter')).toHaveCount(0);
    await expect(rowOf(page, 'Dune')).toBeVisible();
  });

  test('status, type and tag filters and the grouping live in the page menu', async ({ page }) => {
    // Nothing of that sits on the page itself.
    const main = page.locator('main');
    await expect(main.getByRole('button', { name: /^Kochen \(1\)/ })).toHaveCount(0);
    await expect(main.getByLabel('Art')).toHaveCount(0);
    await expect(main.getByRole('switch', { name: 'Erweitert' })).toHaveCount(0);

    const menu = await openBookmarksMenu(page);
    await expect(
      menu.getByRole('menuitemcheckbox', { name: 'Offen', exact: true }),
    ).toHaveAttribute('aria-checked', 'true');
    await expect(menu.getByRole('menuitemcheckbox', { name: 'Erweitert' })).toBeVisible();
    await menu.getByRole('menuitemcheckbox', { name: 'Ansehen' }).click();
    await expect(page.getByTestId('bookmarks-filter')).toContainText('Ansehen');
    await expect(rowOf(page, 'Dune')).toBeVisible();
    await expect(rowOf(page, 'Pasta Rezept')).toHaveCount(0);
    await (
      await openBookmarksMenu(page)
    )
      .getByRole('menuitemcheckbox', { name: 'Alle Arten' })
      .click();
    await expect(rowOf(page, 'Pasta Rezept')).toBeVisible();
  });

  test('entries are grouped; "Gruppieren nach" changes it and nothing is lost', async ({
    page,
  }) => {
    const list = page.getByRole('group', { name: 'Merkliste' });
    await expect(list.getByRole('heading', { name: /Heute/ })).toBeVisible(); // "Zuletzt hinzugefügt"
    await (
      await openBookmarksMenu(page)
    )
      .getByRole('menuitemcheckbox', { name: 'Erster Tag' })
      .click();
    await expect(list.getByRole('heading', { name: /Film/ })).toBeVisible();
    await expect(list.getByRole('heading', { name: /Kochen/ })).toBeVisible();
    await expect(list.getByRole('listitem')).toHaveCount(2);
    await (
      await openBookmarksMenu(page)
    )
      .getByRole('menuitemcheckbox', { name: 'Art', exact: true })
      .click();
    await expect(list.getByRole('heading', { name: /Link/ })).toBeVisible();
    await expect(list.getByRole('listitem')).toHaveCount(2);
  });
});
