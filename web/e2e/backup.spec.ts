import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

async function addTask(page: Page, title: string) {
  await page.goto('/todos?list=inbox');
  await page.getByRole('textbox', { name: 'ToDo hinzufügen' }).fill(title);
  await page.getByRole('button', { name: 'Hinzufügen', exact: true }).click();
  await expect(page.getByRole('checkbox', { name: title })).toBeVisible();
}

async function deleteTask(page: Page, title: string) {
  await page.goto('/todos?list=inbox');
  await page.getByRole('button', { name: new RegExp(title) }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Löschen' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0); // write finished
}

async function titles(page: Page): Promise<string[]> {
  await page.goto('/todos?list=inbox');
  await expect(page.locator('main h1')).toBeVisible();
  // wait until the list has rendered (either tasks or the empty state)
  await expect(
    page.getByRole('checkbox').or(page.getByText('Nichts zu tun – gut so.')).first(),
  ).toBeVisible();
  return (
    await page
      .getByRole('checkbox')
      .evaluateAll((els) => els.map((e) => e.getAttribute('aria-label') ?? ''))
  ).sort();
}

test.describe('backup', () => {
  test('export contains the data but no credentials; merge keeps newer local changes, replace restores the backup', async ({
    page,
  }, info) => {
    await addTask(page, 'Alpha');
    await addTask(page, 'Beta');

    await page.goto('/settings');
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Backup herunterladen' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^nemo-backup-\d{4}-\d{2}-\d{2}\.json$/);
    const path = info.outputPath('backup.json');
    await file.saveAs(path);

    const text = readFileSync(path, 'utf8');
    const backup = JSON.parse(text) as {
      format: string;
      tables: Record<string, { title?: string }[]>;
    };
    expect(backup.format).toBe('taschenmesser-backup');
    expect(backup.tables.todos_task!.map((r) => r.title).sort()).toEqual(['Alpha', 'Beta']);
    for (const local of ['_secrets', '_meta', '_outbox'])
      expect(backup.tables).not.toHaveProperty(local);
    expect(text).not.toContain('syncConfig');

    // Diverge from the backup
    await deleteTask(page, 'Beta');
    await addTask(page, 'Gamma');
    expect(await titles(page)).toEqual(['Alpha', 'Gamma']);

    // Merge: nothing is lost, the newer local delete of Beta wins over the backup
    await page.goto('/settings');
    await page.locator('#backup-file').setInputFiles(path);
    await expect(page.getByTestId('backup-contents')).toContainText('Einträge in');
    await page.getByRole('button', { name: 'Importieren' }).click();
    await expect(page.getByText(/Einträge wiederhergestellt/)).toBeVisible();
    expect(await titles(page)).toEqual(['Alpha', 'Gamma']);

    // Replace: the backup becomes the state
    await page.goto('/settings');
    await page.locator('#backup-file').setInputFiles(path);
    await page.getByRole('radio', { name: /Ersetzen/ }).check();
    await page.getByRole('button', { name: 'Importieren' }).click();
    const confirm = page.getByRole('dialog', { name: 'Backup ersetzen?' });
    await confirm.getByRole('button', { name: 'Ersetzen', exact: true }).click();
    await expect(page.getByText(/1 entfernt/)).toBeVisible();
    expect(await titles(page)).toEqual(['Alpha', 'Beta']);
  });

  test('a backup can be restored into a fresh browser profile', async ({ page, browser }, info) => {
    await addTask(page, 'Mitnehmen');
    await page.goto('/settings');
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Backup herunterladen' }).click();
    const path = info.outputPath('backup.json');
    await (await download).saveAs(path);

    const context = await browser.newContext();
    const fresh = await context.newPage();
    await fresh.goto('/settings');
    await fresh.locator('#backup-file').setInputFiles(path);
    await fresh.getByRole('button', { name: 'Importieren' }).click();
    await expect(fresh.getByText(/Einträge wiederhergestellt/)).toBeVisible();
    expect(await titles(fresh)).toEqual(['Mitnehmen']);
    await context.close();
  });

  test('rejects files that are not backups', async ({ page }) => {
    await page.goto('/settings');
    const input = page.locator('#backup-file');
    await input.setInputFiles({
      name: 'x.json',
      mimeType: 'application/json',
      buffer: Buffer.from('kein json'),
    });
    await expect(page.getByTestId('backup-error')).toHaveText(
      'Die Datei ist keine gültige JSON-Datei.',
    );
    await input.setInputFiles({
      name: 'x.json',
      mimeType: 'application/json',
      buffer: Buffer.from('{"format":"anderes"}'),
    });
    await expect(page.getByTestId('backup-error')).toHaveText('Das ist keine Nemo-Backup-Datei.');
    await input.setInputFiles({
      name: 'x.json',
      mimeType: 'application/json',
      buffer: Buffer.from(
        JSON.stringify({
          format: 'taschenmesser-backup',
          version: 99,
          exportedAt: 'x',
          tables: {},
        }),
      ),
    });
    await expect(page.getByTestId('backup-error')).toHaveText(
      'Das Backup stammt aus einer neueren App-Version.',
    );
    await expect(page.getByRole('button', { name: 'Importieren' })).toHaveCount(0);
  });
});
