import { expect, type Page, test } from '@playwright/test';
import { enable, ready } from './helpers';

const editor = (page: Page) => page.getByRole('textbox', { name: 'Text der Seite' });

test.describe('desktop layout', () => {
  test.skip(({ isMobile }) => isMobile, 'list and page side by side');

  test('the scratch pad is ready to type into, saves by itself and survives a reload', async ({
    page,
  }) => {
    await enable(page, 'notes');
    await ready(page, '/notes');
    await expect(editor(page)).toBeVisible();
    await expect(editor(page)).toBeFocused();
    await page.keyboard.type('Milch kaufen');
    await expect(page.getByText('Gespeichert')).toBeVisible();
    await page.reload();
    await expect(editor(page)).toContainText('Milch kaufen');
  });

  test('Markdown shortcuts, slash menu and keyboard shortcuts format the text', async ({
    page,
  }) => {
    await enable(page, 'notes');
    await ready(page, '/notes?new=1');
    await expect(editor(page)).toBeFocused();
    await page.keyboard.type('# Überschrift');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Normal ');
    await page.keyboard.press('Control+b');
    await page.keyboard.type('fett');
    await page.keyboard.press('Control+b');
    await page.keyboard.press('Enter');
    await page.keyboard.type('- eins');
    await page.keyboard.press('Enter');
    await page.keyboard.type('zwei');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await page.keyboard.type('/check');
    await expect(page.getByRole('option', { name: 'Checkliste' })).toBeVisible();
    await page.keyboard.press('Enter');
    await page.keyboard.type('Aufgabe');
    await expect(editor(page).locator('h1')).toHaveText('Überschrift');
    await expect(editor(page).locator('strong')).toHaveText('fett');
    await expect(editor(page).locator('ul:not([data-type]) li')).toHaveCount(2);
    await expect(editor(page).locator('ul[data-type="taskList"] li')).toHaveCount(1);
    await expect(page.getByText('Gespeichert')).toBeVisible();

    // Stored as Markdown, shown as plain text in the list.
    await page.reload();
    await expect(editor(page)).toBeVisible();
    const list = page.getByRole('navigation', { name: 'Seiten' });
    await expect(list.getByText('Überschrift').first()).toBeVisible();
  });

  test('a new page keeps its title, can be found and deleted with undo', async ({ page }) => {
    await enable(page, 'notes');
    await ready(page, '/notes');
    await page.getByRole('button', { name: 'Neue Seite' }).click();
    await page.getByLabel('Titel der Seite').fill('Gartenplan');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Tomaten pflanzen');
    await expect(page.getByText('Gespeichert')).toBeVisible();
    const list = page.getByRole('navigation', { name: 'Seiten' });
    await expect(list.getByText('Gartenplan')).toBeVisible();
    await list.getByRole('searchbox').fill('tomaten');
    await expect(list.getByText('Gartenplan')).toBeVisible();
    await list.getByRole('searchbox').fill('zzz');
    await expect(list.getByText('Gartenplan')).toHaveCount(0);
    await list.getByRole('searchbox').fill('');
    await page.getByRole('button', { name: 'Löschen' }).click();
    await expect(list.getByText('Gartenplan')).toHaveCount(0);
  });

  test('writing mode hides the page list', async ({ page }) => {
    await enable(page, 'notes');
    await ready(page, '/notes');
    const list = page.getByRole('navigation', { name: 'Seiten' });
    await expect(list).toBeVisible();
    await page.getByRole('button', { name: 'Schreibmodus', exact: true }).click();
    await expect(list).toHaveCount(0);
    await page.getByRole('button', { name: 'Schreibmodus beenden' }).click();
    await expect(list).toBeVisible();
  });
});

test.describe('phone viewport', () => {
  test.use({ viewport: { width: 390, height: 800 } });

  test('list first, tap opens the page, back returns', async ({ page }) => {
    await enable(page, 'notes');
    await ready(page, '/notes');
    const list = page.getByRole('navigation', { name: 'Seiten' });
    await expect(list).toBeVisible();
    await page.getByRole('button', { name: 'Neue Seite' }).click();
    await expect(editor(page)).toBeVisible();
    await page.keyboard.type('Unterwegs notiert');
    await expect(page.getByText('Gespeichert')).toBeVisible();
    await page.getByRole('button', { name: 'Zurück zur Liste' }).click();
    await expect(list.getByText('Unterwegs notiert')).toBeVisible();
  });
});
