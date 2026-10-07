import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { addTask, connect, newDevice, resetServer, serverDump, syncNow } from './helpers';

/**
 * "Fresh install" run for the launch: empty database, setup assistant to the end, sync against the
 * mock server, one entry per core module, backup and restore, language switch, diagnostics preview.
 * It runs with the sync suite (`npm run e2e:sync`, CI job `e2e-sync`) because it needs the server.
 */
test.beforeEach(async ({ request }) => {
  await resetServer(request);
});

const wizard = (page: Page) => page.getByRole('dialog', { name: 'Einrichtung' });

async function ready(page: Page, url: string) {
  await page.goto(url);
  await expect(page.locator('main h1')).toBeVisible();
}

async function save(page: Page) {
  await page.getByRole('dialog').getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

async function finishSetup(page: Page) {
  await ready(page, '/settings/ueber');
  await page.getByRole('button', { name: 'Einrichtung starten' }).click();
  const dialog = wizard(page);
  const summary = dialog.getByTestId('setup-summary');
  const stepOf = dialog.getByText(/^Schritt \d+ von \d+$/);
  for (let i = 0; i < 40; i++) {
    await expect(stepOf.or(summary)).toBeVisible();
    if (await summary.isVisible()) break;
    const label = await stepOf.textContent();
    await dialog.getByRole('button', { name: 'Überspringen' }).click();
    await expect(stepOf.or(summary)).not.toHaveText(label ?? '');
  }
  await dialog.getByRole('button', { name: 'Fertig' }).click();
  await expect(wizard(page)).toHaveCount(0);
  await page.waitForFunction(() => !(history.state as { tmOverlay?: boolean } | null)?.tmOverlay);
}

async function addInvoice(page: Page) {
  await ready(page, '/invoices?new=1');
  const dialog = page.getByRole('dialog', { name: 'Rechnung hinzufügen' });
  await dialog.getByLabel('Empfänger', { exact: true }).fill('Stadtwerke Beispiel');
  await dialog.getByLabel('Betrag').fill('89,90');
  await dialog.getByLabel('Fällig am').fill('2026-10-05');
  await save(page);
}

async function addTransaction(page: Page) {
  await ready(page, '/finance?new=1');
  const dialog = page.getByRole('dialog', { name: 'Buchung hinzufügen' });
  await dialog.getByRole('button', { name: 'Ausgabe', exact: true }).click();
  await dialog.getByLabel('Betrag').fill('12,50');
  await dialog.getByLabel('Kategorie').selectOption({ label: 'Lebensmittel' });
  await save(page);
}

async function addNote(page: Page) {
  await page.goto('/library');
  const card = page.getByTestId('module-notes');
  await card.getByRole('button', { name: 'Aktivieren' }).click();
  await expect(card.getByText('Aktiv', { exact: true })).toBeVisible();
  await ready(page, '/notes?new=1');
  const dialog = page.getByRole('dialog');
  await dialog.getByLabel('Titel').fill('Erste Notiz');
  await dialog.getByLabel('Text').fill('Erfundener Text');
  await save(page);
}

test('fresh install: setup, sync, one entry per core module, backup/restore, language, diagnostics', async ({
  browser,
  request,
}, info) => {
  test.setTimeout(180_000);
  const { page } = await newDevice(browser);
  await page.clock.setFixedTime(new Date('2026-09-29T10:00:00'));

  // 1. a really empty app, setup assistant to the end
  await ready(page, '/');
  await expect(page.getByTestId('setup-welcome')).toBeVisible();
  await finishSetup(page);

  // 2. sync against the mock server
  await connect(page);

  // 3. one entry per core module
  await addTask(page, 'Brot kaufen');
  await addTransaction(page);
  await addInvoice(page);
  await addNote(page);
  await syncNow(page);
  expect((await serverDump(request)).ops.length).toBeGreaterThan(0);

  // 4. backup, lose a task, restore (replace) → the task is back
  await page.goto('/settings/sync');
  const download = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Backup herunterladen' }).click();
  const path = info.outputPath('fresh-backup.json');
  await (await download).saveAs(path);
  const backup = JSON.parse(readFileSync(path, 'utf8')) as { tables: Record<string, unknown[]> };
  for (const table of ['todos_task', 'finance_transaction', 'invoices_invoice', 'notes_note']) {
    expect(backup.tables[table]?.length, table).toBeGreaterThan(0);
  }
  await page.goto('/todos?list=inbox');
  await page.getByRole('button', { name: /Brot kaufen/ }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Löschen' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.goto('/settings/sync');
  await page.locator('#backup-file').setInputFiles(path);
  await page.getByRole('radio', { name: /Ersetzen/ }).check();
  await page.getByRole('button', { name: 'Importieren' }).click();
  await page
    .getByRole('dialog', { name: 'Backup ersetzen?' })
    .getByRole('button', { name: 'Ersetzen', exact: true })
    .click();
  await expect(page.getByText(/Einträge wiederhergestellt|entfernt/).first()).toBeVisible();
  await page.goto('/todos?list=inbox');
  await expect(page.getByRole('checkbox', { name: 'Brot kaufen' })).toBeVisible();

  // 5. the diagnostics file shows the sync state and counts, but no entry contents
  await page.goto('/settings/ueber');
  await page.getByRole('button', { name: 'Diagnose exportieren' }).click();
  const preview = page.getByTestId('diagnostics-preview');
  await expect(preview).toContainText('Connected: true');
  await expect(preview).toContainText(/todos: [1-9]/);
  await expect(preview).not.toContainText('Brot kaufen');
  await expect(preview).not.toContainText('Stadtwerke');
  await expect(preview).not.toContainText('127.0.0.1');
  await page.getByRole('button', { name: 'Schließen' }).first().click();

  // 6. language switch: new texts follow, the choice survives a reload, and back
  await page.getByRole('button', { name: 'English' }).click();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await expect(page.getByRole('heading', { name: 'Diagnostics and bug reports' })).toBeVisible();
  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('lang', 'en');
  await page.getByRole('button', { name: 'Deutsch' }).click();
  await expect(page.getByRole('heading', { name: 'Diagnose und Fehler melden' })).toBeVisible();
});
