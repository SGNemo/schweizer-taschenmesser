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
    await expect(editor(page)).toBeVisible(); // the editor loads lazily
    await page.getByLabel('Titel der Seite').fill('Gartenplan');
    await page.keyboard.press('Enter');
    await page.keyboard.type('Tomaten pflanzen');
    const list = page.getByRole('navigation', { name: 'Seiten' });
    // The list excerpt shows the text once it is stored (autosave).
    await expect(list.getByText('Tomaten pflanzen')).toBeVisible();
    await list.getByRole('searchbox').fill('tomaten');
    await expect(list.getByText('Gartenplan')).toBeVisible();
    await list.getByRole('searchbox').fill('zzz');
    await expect(list.getByText('Gartenplan')).toHaveCount(0);
    await list.getByRole('searchbox').fill('');
    await page.getByRole('button', { name: 'Löschen' }).click();
    await expect(list.getByText('Gartenplan')).toHaveCount(0);
  });

  test('a template fills a new page; the cards view shows the previews; the head carries the paper', async ({
    page,
  }) => {
    await enable(page, 'notes');
    await ready(page, '/notes');
    await expect(page.getByTestId('note-paper')).toBeAttached();
    await page.getByRole('button', { name: 'Vorlage wählen' }).click();
    await page.getByRole('menuitem', { name: 'Besprechung' }).click();
    await expect(editor(page)).toContainText('Beschlüsse');
    await expect(page.getByRole('textbox', { name: 'Titel' })).toHaveValue(/^Besprechung /);
    await page.keyboard.type('x');
    await expect(page.getByText('Gespeichert')).toBeVisible();
    await page.getByRole('radio', { name: 'Karten' }).click();
    await expect(page.getByTestId('note-row').first()).toBeVisible();
    await page.reload();
    await expect(page.getByRole('radio', { name: 'Karten' })).toBeChecked();
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

test.describe('notebook (pages, notebooks, tabs, history, trash)', () => {
  test.skip(({ isMobile }) => isMobile, 'list and page side by side');

  /** Creates a page with a title and text and waits until autosave has stored it (the list shows the text). */
  async function addPage(page: Page, title: string, text: string) {
    await page.getByRole('button', { name: 'Neue Seite' }).click();
    await expect(editor(page)).toBeVisible(); // the editor loads lazily
    await page.getByLabel('Titel der Seite').fill(title);
    await page.keyboard.press('Enter');
    await page.keyboard.type(text);
    await expect(rows(page).filter({ hasText: text })).toBeVisible();
  }
  const rows = (page: Page) => page.getByTestId('note-row');

  test('a notebook gets its pages, pages move between notebooks, counts follow', async ({
    page,
  }) => {
    await enable(page, 'notes');
    await ready(page, '/notes');
    await page.getByRole('button', { name: 'Neues Notizbuch' }).click();
    const dialog = page.getByRole('dialog', { name: 'Neues Notizbuch' });
    await dialog.getByLabel('Name').fill('Arbeit');
    await dialog.getByRole('button', { name: 'Farbe 2' }).click();
    await dialog.getByRole('button', { name: 'Ziel' }).click();
    await dialog.getByRole('button', { name: 'Speichern' }).click();
    const chip = (name: RegExp) => page.getByRole('button', { name });
    await expect(chip(/^Arbeit · 0/)).toHaveAttribute('aria-pressed', 'true');

    // A page created while the notebook is shown lands in it.
    await addPage(page, 'Protokoll', 'Montag besprochen');
    await expect(chip(/^Arbeit · 1/)).toBeVisible();
    await chip(/^Allgemein/).click();
    await expect(rows(page).filter({ hasText: 'Montag besprochen' })).toHaveCount(0);
    await chip(/^Alle Seiten/).click();
    await expect(rows(page).filter({ hasText: 'Montag besprochen' })).toBeVisible();

    // Move it to "Allgemein" through the row menu.
    await rows(page)
      .filter({ hasText: 'Montag besprochen' })
      .getByRole('button', { name: 'Seite: weitere Aktionen' })
      .click();
    await page.getByRole('menuitem', { name: 'In Notizbuch verschieben' }).click();
    await page
      .getByRole('dialog', { name: 'Verschieben nach' })
      .getByRole('button', { name: 'Allgemein' })
      .click();
    await expect(chip(/^Arbeit · 0/)).toBeVisible();
    await expect(chip(/^Allgemein · 1/)).toBeVisible();
  });

  test('open pages become tabs, a tab closes without touching the page', async ({ page }) => {
    await enable(page, 'notes');
    await ready(page, '/notes');
    await addPage(page, 'Erste', 'Text eins');
    await addPage(page, 'Zweite', 'Text zwei');
    const tabs = page.getByRole('navigation', { name: 'Offene Seiten' });
    await expect(tabs.getByRole('button', { name: 'Erste', exact: true })).toBeVisible();
    await expect(tabs.getByRole('button', { name: 'Zweite', exact: true })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await tabs.getByRole('button', { name: 'Erste', exact: true }).click();
    await expect(editor(page)).toContainText('Text eins');
    await tabs.getByRole('button', { name: 'Erste schließen' }).click();
    await expect(rows(page).filter({ hasText: 'Text eins' })).toBeVisible();
  });

  test('history keeps earlier states and restores one', async ({ page }) => {
    await enable(page, 'notes');
    await ready(page, '/notes');
    await addPage(page, 'Verlauf', 'erste Fassung');
    await editor(page).click();
    await page.keyboard.press('End');
    await page.keyboard.type(' und mehr');
    await expect(rows(page).filter({ hasText: 'und mehr' })).toBeVisible();
    await page.getByRole('button', { name: 'Verlauf', exact: true }).click();
    const dialog = page.getByRole('dialog', { name: 'Frühere Stände' });
    await expect(dialog.getByRole('listitem')).toHaveCount(1);
    await expect(dialog.getByText('erste Fassung')).toBeVisible();
    await dialog.getByRole('button', { name: 'Diesen Stand wiederherstellen' }).click();
    await expect(editor(page)).toHaveText('erste Fassung');
  });

  test('a deleted page comes back from the trash', async ({ page }) => {
    await enable(page, 'notes');
    await ready(page, '/notes');
    await addPage(page, 'Flüchtig', 'bald weg');
    await page.getByRole('button', { name: 'Löschen' }).click();
    await expect(rows(page).filter({ hasText: 'bald weg' })).toHaveCount(0);
    await page.getByRole('button', { name: 'Papierkorb' }).click();
    const dialog = page.getByRole('dialog', { name: 'Gelöschte Seiten' });
    await expect(dialog.getByText('Flüchtig')).toBeVisible();
    await dialog.getByRole('button', { name: 'Wiederherstellen' }).click();
    await expect(dialog.getByText('Der Papierkorb ist leer.')).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(rows(page).filter({ hasText: 'bald weg' })).toBeVisible();
  });

  test('Alt+N opens a new page, Alt+Z the scratch pad; sorting by title orders the list', async ({
    page,
  }) => {
    await enable(page, 'notes');
    await ready(page, '/notes');
    await addPage(page, 'Zebra', 'gestreift');
    await page.keyboard.press('Alt+n');
    await expect(page.getByLabel('Titel der Seite')).toHaveValue('');
    await page.getByLabel('Titel der Seite').fill('Apfel');
    await page.keyboard.press('Enter');
    await page.keyboard.type('rund');
    await expect(rows(page).filter({ hasText: 'rund' })).toBeVisible();
    await page.keyboard.press('Alt+z');
    await expect(page.getByRole('heading', { name: 'Schmierzettel', level: 2 })).toBeVisible();

    await page.getByLabel('Sortierung').selectOption({ label: 'Titel' });
    const titles = await rows(page)
      .locator('span')
      .filter({ hasText: /^(Apfel|Zebra)$/ })
      .allTextContents();
    expect(titles).toEqual(['Apfel', 'Zebra']);
  });

  test('a selection of the scratch pad moves into a new page', async ({ page }) => {
    await enable(page, 'notes');
    await ready(page, '/notes');
    await editor(page).click();
    await page.keyboard.type('Einkauf Brot');
    await page.keyboard.press('Shift+Home');
    await page.getByRole('button', { name: 'In neue Seite verschieben' }).click();
    await expect(editor(page)).toContainText('Einkauf Brot');
    await expect(page.getByLabel('Titel der Seite')).toHaveValue('');
    await expect(rows(page).filter({ hasText: 'Einkauf Brot' })).toBeVisible();
  });
});

test.describe('notebook (links, search, export, import, to-do)', () => {
  test.skip(({ isMobile }) => isMobile, 'list and page side by side');
  const rows = (page: Page) => page.getByTestId('note-row');
  async function addPage(page: Page, title: string, text: string) {
    await page.getByRole('button', { name: 'Neue Seite' }).click();
    await expect(editor(page)).toBeVisible(); // the editor loads lazily
    await page.getByLabel('Titel der Seite').fill(title);
    await page.keyboard.press('Enter');
    await page.keyboard.type(text);
    await expect(page.getByText('Gespeichert')).toBeVisible();
  }

  test('[[ links pages, a click opens the target, the target lists its backlinks', async ({
    page,
  }) => {
    await enable(page, 'notes');
    await ready(page, '/notes');
    await addPage(page, 'Zielseite', 'Inhalt des Ziels');
    await addPage(page, 'Startseite', 'Siehe');
    await editor(page).click();
    await page.keyboard.press('End');
    await page.keyboard.type(' [[Ziel');
    await expect(page.getByRole('option', { name: 'Zielseite' })).toBeVisible();
    await page.keyboard.press('Enter');
    const link = editor(page).locator('.wikilink');
    await expect(link).toHaveText('Zielseite');
    await expect(rows(page).filter({ hasText: '[[' })).toHaveCount(0); // stored as a link, shown as text
    await link.click();
    await expect(page.getByLabel('Titel der Seite')).toHaveValue('Zielseite');
    const back = page.getByRole('navigation', { name: 'Verweise auf diese Seite' });
    await expect(back.getByRole('button', { name: 'Startseite' })).toBeVisible();
    await back.getByRole('button', { name: 'Startseite' }).click();
    await expect(page.getByLabel('Titel der Seite')).toHaveValue('Startseite');
  });

  test('an unknown link creates its page when clicked', async ({ page }) => {
    await enable(page, 'notes');
    await ready(page, '/notes');
    await addPage(page, 'Anfang', 'Weiter bei [[Neues Ziel]] ');
    await editor(page).locator('.wikilink').click();
    await expect(page.getByLabel('Titel der Seite')).toHaveValue('Neues Ziel');
    await expect(rows(page).filter({ hasText: 'Neues Ziel' }).first()).toBeVisible();
  });

  test('searching shows the text around the hit', async ({ page }) => {
    await enable(page, 'notes');
    await ready(page, '/notes');
    await addPage(
      page,
      'Beete',
      `${'Erde lockern, '.repeat(8)}dann Gurken säen ${'und gießen. '.repeat(8)}`,
    );
    await page.getByRole('searchbox').fill('gurken');
    const row = rows(page).filter({ hasText: 'Beete' });
    await expect(row).toContainText('dann Gurken säen');
    await expect(row).toContainText('…');
  });

  test('a page exports as Markdown with its title', async ({ page }) => {
    await enable(page, 'notes');
    await ready(page, '/notes');
    await addPage(page, 'Exportseite', 'Inhalt zum Mitnehmen');
    await page.getByTestId('notes-export').click();
    const dialog = page.getByRole('dialog', { name: 'Exportieren' });
    const download = page.waitForEvent('download');
    await dialog.getByRole('button', { name: 'Markdown (.md)' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe('Exportseite.md');
    const path = await file.path();
    const { readFileSync } = await import('node:fs');
    expect(readFileSync(path, 'utf8')).toContain('# Exportseite\n\nInhalt zum Mitnehmen');
  });

  test('import takes several files and a folder (folder = notebook), duplicates are skipped', async ({
    page,
  }, info) => {
    await enable(page, 'notes');
    await ready(page, '/notes');
    const { mkdirSync, writeFileSync } = await import('node:fs');
    const dir = info.outputPath('Reisen');
    mkdirSync(dir, { recursive: true });
    writeFileSync(`${dir}/Rom.md`, '# Rom\n\nColosseum besuchen');
    writeFileSync(`${dir}/Packliste.txt`, 'Socken\nZahnbürste');

    await page.getByTestId('notes-import').click();
    const dialog = page.getByRole('dialog', { name: 'Dateien importieren' });
    await dialog.locator('input[type=file][webkitdirectory]').setInputFiles(dir);
    await expect(dialog.getByRole('status')).toContainText('2 Seiten, 1 Notizbuch');
    await dialog.getByRole('button', { name: 'Importieren' }).click();
    await expect(page.getByRole('button', { name: /^Reisen · 2/ })).toBeVisible();
    await page.getByRole('button', { name: /^Reisen · 2/ }).click();
    await expect(rows(page).filter({ hasText: 'Colosseum besuchen' })).toBeVisible();

    // The same folder again: nothing new.
    await page.getByTestId('notes-import').click();
    await page
      .getByRole('dialog', { name: 'Dateien importieren' })
      .locator('input[type=file][webkitdirectory]')
      .setInputFiles(dir);
    await expect(page.getByRole('dialog', { name: 'Dateien importieren' })).toContainText(
      '2 doppelte Seiten',
    );
  });

  test('a selected checklist item becomes a to-do', async ({ page }) => {
    await enable(page, 'notes');
    await ready(page, '/notes?new=1');
    await expect(editor(page)).toBeFocused();
    await page.keyboard.type('- [ ] Fahrrad ölen');
    await page.keyboard.press('Shift+Home');
    await page.getByRole('button', { name: 'Als ToDo übernehmen' }).click();
    await expect(page.getByText('Als ToDo übernommen.')).toBeVisible();
    await ready(page, '/todos');
    await expect(page.getByText('Fahrrad ölen').first()).toBeVisible();
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
    await expect(list.getByText('Unterwegs notiert').first()).toBeVisible();
  });
});
