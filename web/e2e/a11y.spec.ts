import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/** Deterministic "today": Tuesday 2026-09-29, 10:00 local time. */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
});

const MODULES = [
  'calendar',
  'todos',
  'finance',
  'invoices',
  'subscriptions',
  'bookmarks',
  'notes',
  'budgets',
  'vault',
  'accounts',
  'pantry',
  'people',
  'lists',
];

/** Enables every module (raw write into the module table, like the library would do). */
async function enableAll(page: Page) {
  await page.goto('/');
  await expect(page.locator('main h1')).toBeVisible();
  await page.evaluate(
    (ids) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('taschenmesser');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const tx = db.transaction('_modules', 'readwrite');
          for (const id of ids) {
            tx.objectStore('_modules').put({
              id,
              enabled: true,
              dataPolicy: null,
              createdAt: 1,
              updatedAt: 1,
              deviceId: 'e2e',
              deletedAt: null,
              _f: {},
            });
          }
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    MODULES,
  );
}

async function audit(page: Page, label: string) {
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'])
    .analyze();
  const summary = results.violations.map(
    (v) =>
      `${v.id} (${v.impact}): ${v.help}\n${v.nodes
        .slice(0, 3)
        .map((n) => `   ${n.target.join(' ')}\n   ${n.failureSummary?.split('\n')[1] ?? ''}`)
        .join('\n')}`,
  );
  expect(summary, `${label}\n${summary.join('\n')}`).toEqual([]);
}

const PAGES = [
  ['dashboard', '/'],
  ['library', '/library'],
  ['tools', '/tools'],
  ['settings', '/settings'],
  ['settings-allgemein', '/settings/allgemein'],
  ['settings-darstellung', '/settings/darstellung'],
  ['settings-module', '/settings/module'],
  ['settings-werkzeuge', '/settings/werkzeuge'],
  ['settings-benachrichtigungen', '/settings/benachrichtigungen'],
  ['settings-sicherheit', '/settings/sicherheit'],
  ['settings-sync', '/settings/sync'],
  ['settings-ki', '/settings/ki'],
  ['settings-verbindungen', '/settings/verbindungen'],
  ['settings-schnellerfassung', '/settings/schnellerfassung'],
  ['settings-updates', '/settings/updates'],
  ['settings-ueber', '/settings/ueber'],
  ['calendar', '/calendar'],
  ['todos', '/todos'],
  ['calendar reminders', '/calendar?tab=reminders'],
  ['finance', '/finance'],
  ['finance transactions', '/finance?tab=transactions'],
  ['invoices', '/invoices'],
  ['subscriptions', '/subscriptions'],
  ['bookmarks', '/bookmarks'],
  ['notes', '/notes'],
  ['budgets', '/budgets'],
  ['budgets goals', '/budgets?tab=goals'],
  ['vault', '/vault'],
  ['accounts (set up)', '/accounts'],
  ['pantry', '/pantry'],
  ['people', '/people'],
  ['lists', '/lists'],
  ['bookmarks links', '/bookmarks?view=links'],
  ['components sheet', '/dev/components'],
  ['share', '/share?title=Beispiel&text=Schau%20mal%20https%3A%2F%2Fbeispiel.example%2Fx'],
] as const;

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`accessibility (${scheme})`, () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme, reducedMotion: 'reduce' });
      await enableAll(page);
    });

    for (const [name, url] of PAGES) {
      test(`page: ${name}`, async ({ page }) => {
        await page.goto(url);
        await expect(page.locator('main h1')).toBeVisible();
        await audit(page, `${name} (${scheme})`);
      });
    }

    test('tools: toolbar sheet and every tool', async ({ page }) => {
      test.setTimeout(120_000); // audits 12 tools one after the other
      await page.goto('/tools');
      await expect(page.getByTestId('tool-calc')).toBeVisible();
      const names: string[] = [];
      for (const card of await page.locator('[data-testid^="tool-"]').all()) {
        const name = (await card.locator('span[class*="moduleName"]').innerText()).trim();
        const toggle = card.getByLabel(`${name} einschalten`);
        if (!(await toggle.isChecked())) await toggle.click();
        await expect(toggle).toBeChecked();
        names.push(name);
      }
      expect(names.length).toBeGreaterThanOrEqual(12);
      await page.getByRole('button', { name: 'Werkzeuge' }).first().click();
      await expect(page.getByRole('dialog', { name: 'Werkzeuge' })).toBeVisible();
      await audit(page, `tools sheet (${scheme})`);
      for (const name of names) {
        await page.getByRole('dialog').getByRole('button', { name, exact: true }).click();
        await expect(page.getByRole('dialog', { name })).toBeVisible();
        await audit(page, `tool ${name} (${scheme})`);
        await page.getByRole('button', { name: 'Zurück zu den Werkzeugen' }).click();
      }
    });

    test('settings: AI providers (list, expanded form)', async ({ page }) => {
      await page.goto('/settings/ki');
      const section = page.locator('section[aria-labelledby="ai"]');
      await section.getByLabel('Anbieter hinzufügen').selectOption({ label: 'Groq' });
      await expect(section.getByTestId('provider-groq')).toBeVisible();
      await section.getByLabel('Anbieter hinzufügen').selectOption({ label: 'Ollama (lokal)' });
      await expect(section.getByTestId('provider-ollama')).toBeVisible();
      await audit(page, `ai providers (${scheme})`);
    });

    test('accounts: lock screen, list, entry dialogs, tools', async ({ page }) => {
      const MASTER = 'Mein-Master-Passwort-1';
      await page.goto('/accounts');
      await page.getByLabel('Master-Passwort', { exact: true }).fill(MASTER);
      await page.getByLabel('Master-Passwort wiederholen').fill(MASTER);
      await page.getByRole('button', { name: 'Tresor erstellen' }).click();
      await expect(page.getByRole('button', { name: 'Zugang hinzufügen' })).toBeVisible({
        timeout: 20_000,
      });
      await audit(page, `accounts empty (${scheme})`);

      await page.getByRole('button', { name: 'Zugang hinzufügen' }).click();
      const form = page.getByRole('dialog', { name: 'Zugang hinzufügen' });
      await form.getByLabel('Name', { exact: true }).fill('Beispiel');
      await form.getByLabel('Passwort', { exact: true }).fill('ein-ganz-normales-passwort-1');
      await form.getByLabel('Einmalcode (TOTP)').fill('JBSWY3DPEHPK3PXP');
      await form.getByRole('button', { name: 'Generator' }).click();
      await expect(form.getByTestId('generated')).toHaveText(/\S{20}/);
      await expect(form.getByTestId('strength')).toBeVisible();
      await audit(page, `accounts form + generator (${scheme})`);
      await form.getByRole('button', { name: 'Speichern' }).click();

      // a dialog on phones, the side panel ("Details") from 1200 px
      const detail = page
        .getByRole('dialog', { name: 'Beispiel' })
        .or(page.getByRole('complementary', { name: 'Details' }));
      await expect(detail.getByTestId('totp-code')).toBeVisible();
      await audit(page, `accounts detail (${scheme})`);
      await page.keyboard.press('Escape');
      await audit(page, `accounts list (${scheme})`);

      await page.getByRole('button', { name: 'Import, Export & Sicherheit' }).click();
      await expect(page.getByRole('dialog', { name: 'Import, Export & Sicherheit' })).toBeVisible();
      await audit(page, `accounts tools (${scheme})`);
      await page.keyboard.press('Escape');

      await page.getByRole('button', { name: 'Sperren' }).click();
      await expect(page.getByLabel('Master-Passwort')).toBeVisible();
      await audit(page, `accounts locked (${scheme})`);
    });

    test('shell: sidebar, rail and the "Mehr" sheet', async ({ page }, info) => {
      await page.goto('/');
      await expect(page.locator('main h1')).toBeVisible();
      const nav = page.getByRole('navigation', { name: 'Hauptnavigation' });
      if (info.project.name === 'pixel-7') {
        await nav.getByRole('button', { name: 'Mehr' }).click();
        await expect(page.getByRole('dialog', { name: 'Mehr' })).toBeVisible();
        await audit(page, `more sheet (${scheme})`);
        return;
      }
      await audit(page, `sidebar (${scheme})`);
      await page.setViewportSize({ width: 1100, height: 800 });
      await expect(nav.getByRole('link', { name: 'Planen' })).toBeVisible();
      await audit(page, `rail (${scheme})`);
    });

    test('start-data wizard: choose, input, preview, result, help hint', async ({ page }) => {
      await page.goto('/todos');
      await page.getByRole('button', { name: 'Startdaten einrichten' }).click();
      const dialog = page.getByRole('dialog', { name: /Startdaten/ });
      await expect(dialog).toBeVisible();
      await audit(page, `wizard choose (${scheme})`);
      await dialog.getByRole('button', { name: /Hilfe/ }).click();
      await expect(dialog.getByRole('tooltip')).toBeVisible();
      await audit(page, `wizard help hint open (${scheme})`);
      await page.keyboard.press('Escape'); // closes the hint first, not the dialog
      await expect(dialog).toBeVisible();

      await dialog.getByRole('button', { name: /Aufgaben einfügen/ }).click();
      await audit(page, `wizard input (${scheme})`);
      await dialog.getByLabel('Eine Zeile = ein Eintrag').fill('Erste Aufgabe\nZweite Aufgabe');
      await dialog.getByRole('button', { name: 'Vorschau anzeigen' }).click();
      await expect(dialog.getByText('2 Einträge erkannt')).toBeVisible();
      await audit(page, `wizard preview (${scheme})`);
      await dialog.getByRole('button', { name: '2 Einträge importieren' }).click();
      await expect(dialog.getByRole('status')).toHaveText('2 Einträge wurden importiert.');
      await audit(page, `wizard result (${scheme})`);
    });

    test('dialogs: command palette, quick add, create forms', async ({ page }) => {
      await page.goto('/');
      await page.locator('header button', { hasText: 'Suchen' }).click();
      await expect(page.getByRole('combobox')).toBeVisible();
      await audit(page, `palette (${scheme})`);
      await page.getByRole('combobox').fill('Was steht heute an?');
      await page.getByRole('combobox').press('Enter');
      await expect(page.getByTestId('ai-answer')).toBeVisible();
      await audit(page, `assistant answer (${scheme})`);
      await page.keyboard.press('Escape');

      for (const url of [
        '/invoices?new=1',
        '/bookmarks?new=1',
        '/notes?new=1',
        '/vault?new=1',
        '/people?new=1',
        '/budgets?tab=goals&new=1',
        '/calendar?tab=reminders&new=1',
      ]) {
        await page.goto(url);
        await expect(page.getByRole('dialog'), url).toBeVisible();
        await audit(page, `${url} (${scheme})`);
      }
    });
  });
}

test('the audit really detects problems', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('main h1')).toBeVisible();
  await page.evaluate(() => {
    document
      .querySelector('main')
      ?.insertAdjacentHTML('beforeend', '<img src="x.png"><button></button>');
  });
  const results = await new AxeBuilder({ page }).withTags(['wcag2a']).analyze();
  expect(results.violations.map((v) => v.id)).toEqual(
    expect.arrayContaining(['image-alt', 'button-name']),
  );
});
