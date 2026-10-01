import { expect, test, type Page } from '@playwright/test';

const MASTER = 'Mein-Master-Passwort-1';
const SECRET_TITLE = 'Beispiel-Bank-Konto';
const SECRET_PASSWORD = 'geheimes-passwort-4711'; // gitleaks:allow (test fixture)

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
});

async function enableAccounts(page: Page) {
  await page.goto('/library');
  const card = page.getByTestId('module-accounts');
  await card.getByRole('button', { name: 'Aktivieren' }).click();
  await expect(card.getByText('Aktiv', { exact: true })).toBeVisible();
}

async function setUp(page: Page) {
  await enableAccounts(page);
  await page.goto('/accounts');
  await page.getByLabel('Master-Passwort', { exact: true }).fill(MASTER);
  await page.getByLabel('Master-Passwort wiederholen').fill(MASTER);
  await page.getByRole('button', { name: 'Tresor erstellen' }).click(); // Argon2id, 64 MiB
  await expect(page.getByRole('button', { name: 'Zugang hinzufügen' })).toBeVisible({
    timeout: 20_000,
  });
}

async function addEntry(page: Page, fields: Record<string, string> = {}) {
  await page.getByRole('button', { name: 'Zugang hinzufügen' }).click();
  const dialog = page.getByRole('dialog', { name: 'Zugang hinzufügen' });
  await dialog.getByLabel('Name', { exact: true }).fill(fields.title ?? SECRET_TITLE);
  await dialog.getByLabel('Benutzername').fill(fields.username ?? 'alice');
  await dialog.getByLabel('Passwort', { exact: true }).fill(fields.password ?? SECRET_PASSWORD);
  if (fields.totp) await dialog.getByLabel('Einmalcode (TOTP)').fill(fields.totp);
  await dialog.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('dialog', { name: 'Zugang hinzufügen' })).toHaveCount(0);
}

/** Everything stored for the vault, read straight from IndexedDB. */
async function storedText(page: Page): Promise<string> {
  return page.evaluate(
    () =>
      new Promise<string>((resolve, reject) => {
        const open = indexedDB.open('taschenmesser');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const out: unknown[] = [];
          const tx = db.transaction(['accounts_vault', 'accounts_entry', '_outbox']);
          for (const name of ['accounts_vault', 'accounts_entry', '_outbox']) {
            tx.objectStore(name).getAll().onsuccess = (e) =>
              out.push((e.target as IDBRequest).result);
          }
          tx.oncomplete = () => {
            db.close();
            resolve(JSON.stringify(out));
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
}

test('accounts are off until enabled', async ({ page }) => {
  await page.goto('/library');
  await expect(
    page.getByTestId('module-accounts').getByRole('button', { name: 'Aktivieren' }),
  ).toBeVisible();
});

test('set up the vault, add an entry, lock, wrong password, unlock', async ({ page }) => {
  await setUp(page);
  await expect(page.getByText('Noch keine Zugänge.')).toBeVisible();
  await addEntry(page, { totp: 'JBSWY3DPEHPK3PXP' });

  // the detail view opens after saving: password hidden until "Anzeigen", TOTP code visible
  const detail = page.getByRole('dialog', { name: SECRET_TITLE });
  await expect(detail.getByTestId('password-value')).not.toContainText(SECRET_PASSWORD);
  await detail.getByRole('button', { name: 'Anzeigen' }).click();
  await expect(detail.getByTestId('password-value')).toContainText(SECRET_PASSWORD);
  await expect(detail.getByTestId('totp-code')).toHaveText(/^\d{3} \d{3}$/);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('listitem').filter({ hasText: SECRET_TITLE })).toBeVisible();

  // what is stored is ciphertext only
  const stored = await storedText(page);
  expect(stored).toContain('v1.');
  for (const secret of [SECRET_TITLE, SECRET_PASSWORD, 'alice', 'JBSWY3DPEHPK3PXP', MASTER]) {
    expect(stored, secret).not.toContain(secret);
  }

  await page.getByRole('button', { name: 'Sperren' }).click();
  await expect(page.getByLabel('Master-Passwort')).toBeVisible();
  await expect(page.locator('body')).not.toContainText(SECRET_TITLE);
  await expect(page.locator('body')).not.toContainText(SECRET_PASSWORD);

  await page.getByLabel('Master-Passwort').fill('falsches-passwort-1');
  await page.getByRole('button', { name: 'Entsperren' }).click();
  await expect(page.getByRole('alert')).toHaveText('Falsches Master-Passwort.');

  await page.getByLabel('Master-Passwort').fill(MASTER);
  await page.getByRole('button', { name: 'Entsperren' }).click();
  await expect(page.getByRole('listitem').filter({ hasText: SECRET_TITLE })).toBeVisible({
    timeout: 20_000,
  });
});

test('the vault stays locked after a reload (keys live in memory only)', async ({ page }) => {
  await setUp(page);
  await addEntry(page);
  await page.reload();
  await expect(page.getByLabel('Master-Passwort')).toBeVisible();
  await expect(page.locator('body')).not.toContainText(SECRET_TITLE);
});

test('the generator fills the password field and the strength meter reacts', async ({ page }) => {
  await setUp(page);
  await page.getByRole('button', { name: 'Zugang hinzufügen' }).click();
  const dialog = page.getByRole('dialog', { name: 'Zugang hinzufügen' });
  await dialog.getByLabel('Passwort', { exact: true }).fill('passwort');
  await expect(dialog.getByTestId('strength')).toHaveAttribute('data-score', /^[01]$/);

  await dialog.getByRole('button', { name: 'Generator' }).click();
  const generated = dialog.getByTestId('generated');
  await expect(generated).toHaveText(/^\S{20}$/);
  await dialog.getByRole('button', { name: 'Übernehmen' }).click();
  await expect(dialog.getByLabel('Passwort', { exact: true })).toHaveValue(/^\S{20}$/);
  await expect(dialog.getByTestId('strength')).toHaveAttribute('data-score', /^[34]$/);
});

test('search finds entries only in the unlocked vault', async ({ page }) => {
  await setUp(page);
  await addEntry(page, { title: 'Alpha Shop' });
  await page.keyboard.press('Escape'); // the detail view opens after saving
  await addEntry(page, { title: 'Beta Bank' });
  await page.keyboard.press('Escape');
  await page.getByLabel('Accounts durchsuchen').fill('beta');
  await expect(page.getByRole('listitem').filter({ hasText: 'Beta Bank' })).toBeVisible();
  await expect(page.getByRole('listitem').filter({ hasText: 'Alpha Shop' })).toHaveCount(0);
});

test('Bitwarden CSV import adds entries; the export needs a confirmation', async ({ page }) => {
  await setUp(page);
  await page.getByRole('button', { name: 'Import, Export & Sicherheit' }).click();
  const tools = page.getByRole('dialog', { name: 'Import, Export & Sicherheit' });

  const csv = [
    'folder,favorite,type,name,notes,fields,reprompt,login_uri,login_username,login_password,login_totp',
    'Privat,,login,Importiertes Konto,,,0,https://example.org,bob,geheim-import-1,',
  ].join('\n');
  const chooser = page.waitForEvent('filechooser');
  await tools.getByRole('button', { name: 'Bitwarden-CSV importieren' }).click();
  await (
    await chooser
  ).setFiles({
    name: 'bitwarden.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(csv),
  });
  await expect(page.getByText('1 importiert.')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('listitem').filter({ hasText: 'Importiertes Konto' })).toBeVisible();

  await page.getByRole('button', { name: 'Import, Export & Sicherheit' }).click();
  const exportButton = page
    .getByRole('dialog', { name: 'Import, Export & Sicherheit' })
    .getByRole('button', { name: /Als Bitwarden-CSV exportieren/ });
  await expect(exportButton).toBeDisabled();
  await page.getByRole('switch', { name: /Ich verstehe/ }).click();
  await expect(exportButton).toBeEnabled();
});

test('the vault locks itself after the configured inactivity', async ({ page }) => {
  await page.clock.install({ time: new Date('2026-09-29T10:00:00') });
  await setUp(page);
  await addEntry(page);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('listitem').filter({ hasText: SECRET_TITLE })).toBeVisible();

  await page.clock.fastForward(4 * 60_000); // default: 5 minutes
  await expect(page.getByRole('listitem').filter({ hasText: SECRET_TITLE })).toBeVisible();
  await page.clock.fastForward(2 * 60_000);
  await expect(page.getByLabel('Master-Passwort')).toBeVisible();
  await expect(page.locator('body')).not.toContainText(SECRET_TITLE);
});

test('generate a password and save it as an account in one go', async ({ page }) => {
  await setUp(page);
  await page.getByRole('button', { name: 'Neues Passwort' }).click();
  const generator = page.getByRole('dialog', { name: 'Neues Passwort' });
  const generated = (await generator.getByTestId('generated').textContent()) ?? '';
  expect(generated).toHaveLength(20);
  await generator.getByRole('button', { name: 'Als Account speichern' }).click();

  const form = page.getByRole('dialog', { name: 'Zugang hinzufügen' });
  await expect(form.getByLabel('Passwort', { exact: true })).toHaveValue(generated);
  await form.getByLabel('Name', { exact: true }).fill('Beispiel-Shop');
  await form.getByLabel('Benutzername').fill('alice@example.org');
  await form.getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('dialog', { name: 'Zugang hinzufügen' })).toHaveCount(0);

  // Listed in the vault, and only ciphertext reached storage / the outbox.
  await expect(page.getByRole('button', { name: /Beispiel-Shop/ }).first()).toBeVisible();
  const stored = await storedText(page);
  expect(stored).not.toContain(generated);
  expect(stored).not.toContain('Beispiel-Shop');
});
