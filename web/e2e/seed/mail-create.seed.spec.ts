import { expect, type Locator, type Page } from '@playwright/test';
import { showPreview } from '../helpers';
import { bootDev, test } from './helpers';

/**
 * „Aus dieser Mail anlegen“ with the target's fields (fix/mail-create-fields): every destination shows its fields,
 * prefilled from the mail, a missing one is named at the field only after a save attempt, and the entry is listed
 * under the mail. The large seed holds the invented letter mail („Kanzlei Beispiel & Partner“), which the medium
 * seed of the stimulus inventory leaves out. Poses as the desktop app because the module is desktop-only.
 */
const asDesktop = (page: Page) =>
  page.addInitScript(() => localStorage.setItem('__tmPlatformKind', 'desktop'));

async function enableMail(page: Page) {
  await page.goto('/');
  await expect(page.locator('main h1')).toBeVisible();
  await page.evaluate(
    () =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open('taschenmesser');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const tx = open.result.transaction('_modules', 'readwrite');
          tx.objectStore('_modules').put({
            id: 'mail',
            enabled: true,
            dataPolicy: null,
            createdAt: 1,
            updatedAt: 1,
            deviceId: 'e2e',
            deletedAt: null,
            _f: {},
          });
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        };
      }),
  );
}

test.describe('mail: create from a mail, with fields', () => {
  test.setTimeout(60_000);
  test.use({ seeded: { scale: 'large', desktop: true, preview: true } });
  test.beforeEach(async ({ page }) => {
    await bootDev(page);
    await showPreview(page);
    await asDesktop(page);
    await enableMail(page);
  });

  /** Opens „Aus dieser Mail anlegen“ → `what` on the mail with this subject; returns the dialog. */
  async function createFrom(page: Page, subject: string, what: string) {
    await page.goto('/mail');
    await page.getByText(subject).first().click();
    await page.getByRole('button', { name: 'Aus dieser Mail anlegen' }).click();
    await page.getByRole('menuitem', { name: what }).click();
    const dialog = page.getByRole('dialog');
    await expect(dialog.getByTestId('capture-fields')).toBeVisible();
    return dialog;
  }
  const fieldOf = (dialog: Locator, key: string) => dialog.locator(`[data-field="${key}"]`);
  const saveButton = (dialog: Locator) =>
    dialog.getByRole('button', { name: /^(Speichern|.+ eintragen)$/ });

  test('a letter without „Rechnung“: the invoice fields come prefilled and save with the link', async ({
    page,
  }) => {
    const dialog = await createFrom(page, 'Ihr Zeichen AB-77 – Kostennote', 'Rechnung');
    await expect(fieldOf(dialog, 'title').getByRole('textbox')).toHaveValue(
      /Kanzlei Beispiel & Partner/,
    );
    await expect(fieldOf(dialog, 'amountMinor').getByRole('textbox')).toHaveValue('186,40');
    await expect(fieldOf(dialog, 'date').getByRole('textbox')).not.toHaveValue('');
    await expect(fieldOf(dialog, 'reference').getByRole('textbox')).toHaveValue('AB-77');
    // Nothing red before a save was tried.
    await expect(dialog.getByRole('alert')).toHaveCount(0);
    await saveButton(dialog).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByTestId('mail-linked')).toContainText('Rechnung: Kanzlei Beispiel');
    await page.getByTestId('mail-linked').getByRole('link').click();
    await expect(page).toHaveURL(/\/invoices/);
    await expect(page.getByText('Kanzlei Beispiel & Partner').first()).toBeVisible();
  });

  test('a missing amount is named at its field, only after a save attempt', async ({ page }) => {
    const dialog = await createFrom(page, 'Fotos vom Ausflug', 'Rechnung');
    await expect(dialog.getByText('Bitte ausfüllen.')).toHaveCount(0);
    await saveButton(dialog).click();
    await expect(fieldOf(dialog, 'amountMinor').getByText('Bitte ausfüllen.')).toBeVisible();
    await expect(dialog.getByText('Der Eintrag ist unvollständig.')).toHaveCount(0);
    await fieldOf(dialog, 'amountMinor').getByRole('textbox').fill('12,50');
    await expect(dialog.getByText('Bitte ausfüllen.')).toHaveCount(0);
    await saveButton(dialog).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByTestId('mail-linked')).toContainText('Rechnung: Max Muster');
  });

  test('an appointment from a mail: date and time fields, saved with the link', async ({
    page,
  }) => {
    const dialog = await createFrom(page, 'Termin Ablesung Heizung', 'Termin');
    await expect(fieldOf(dialog, 'date')).toBeVisible();
    await expect(fieldOf(dialog, 'time')).toBeVisible();
    await fieldOf(dialog, 'time').getByRole('textbox').fill('09:00');
    await saveButton(dialog).click();
    await expect(dialog).toHaveCount(0);
    await expect(page.getByTestId('mail-linked')).toContainText('Termin: Termin Ablesung Heizung');
  });

  test('a plan entry from a mail: the chip swaps in duration and deadline, saved with the link', async ({
    page,
  }) => {
    const dialog = await createFrom(page, 'Umzugshilfe am Sonntag?', 'ToDo');
    const more = dialog.getByTestId('capture-more-types');
    if (await more.isVisible()) await more.click();
    await dialog.getByRole('radio', { name: 'Plan' }).click();
    await expect(fieldOf(dialog, 'estimateMin')).toBeVisible();
    await expect(fieldOf(dialog, 'date')).toBeVisible();
    await fieldOf(dialog, 'estimateMin').getByRole('textbox').fill('120');
    await saveButton(dialog).click();
    await expect(dialog).toHaveCount(0);
    // A plan entry is a ToDo in the planner: the thread lists it as one.
    await expect(page.getByTestId('mail-linked')).toContainText('ToDo: Umzugshilfe');
  });

  test('an expense from a mail: amount and date fields, booked only after the confirmation', async ({
    page,
  }) => {
    const dialog = await createFrom(page, 'Ihr Zeichen AB-77 – Kostennote', 'Rechnung');
    const more = dialog.getByTestId('capture-more-types');
    if (await more.isVisible()) await more.click();
    await dialog.getByRole('radio', { name: 'Ausgabe' }).click();
    await expect(fieldOf(dialog, 'reference')).toHaveCount(0);
    await expect(fieldOf(dialog, 'amountMinor').getByRole('textbox')).toHaveValue('186,40');
    await saveButton(dialog).click();
    // Money only after „Buchen“, as everywhere.
    await dialog.getByRole('button', { name: 'Buchen' }).click();
    await expect(dialog).toHaveCount(0);
    // Finance keeps no mail link (its entries have no link field): the booking itself is the proof.
    const payees = await page.evaluate(
      () =>
        new Promise<string[]>((resolve, reject) => {
          const open = indexedDB.open('taschenmesser');
          open.onerror = () => reject(open.error);
          open.onsuccess = () => {
            const req = open.result
              .transaction('finance_transaction')
              .objectStore('finance_transaction')
              .getAll();
            req.onsuccess = () =>
              resolve(
                (req.result as { payee?: string; amountMinor: number }[]).flatMap((r) =>
                  r.amountMinor === 18640 && r.payee ? [r.payee] : [],
                ),
              );
          };
        }),
    );
    expect(payees).toContain('Kanzlei Beispiel & Partner');
  });
});
