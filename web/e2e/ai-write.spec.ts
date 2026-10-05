import { expect, test, type Page } from '@playwright/test';

/** Deterministic "today": Tuesday 2026-09-29, 10:00 local time. */
test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
});

const DB = 'taschenmesser';

async function boot(page: Page) {
  await page.goto('/');
  await expect(page.locator('main h1')).toBeVisible();
}

/** Rows straight into IndexedDB (invented data). */
async function seed(page: Page, tables: Record<string, Record<string, unknown>[]>) {
  await page.evaluate(
    ({ db: name, tables: t }) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open(name);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const names = Object.keys(t);
          const tx = db.transaction(names, 'readwrite');
          for (const table of names) {
            for (const { id, ...rest } of t[table]!) {
              tx.objectStore(table).put({
                ...rest,
                id,
                createdAt: 1,
                updatedAt: 1,
                deviceId: 'e2e',
                deletedAt: null,
                _f: {},
              });
            }
          }
          tx.oncomplete = () => {
            db.close();
            resolve();
          };
          tx.onerror = () => reject(tx.error);
        };
      }),
    { db: DB, tables },
  );
}

async function rows(page: Page, table: string): Promise<Record<string, unknown>[]> {
  return page.evaluate(
    ({ db: name, table: t }) =>
      new Promise<Record<string, unknown>[]>((resolve, reject) => {
        const open = indexedDB.open(name);
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const req = db.transaction(t).objectStore(t).getAll();
          req.onsuccess = () => {
            db.close();
            resolve(
              (req.result as (Record<string, unknown> & { deletedAt: number | null })[]).filter(
                (r) => r.deletedAt === null,
              ),
            );
          };
          req.onerror = () => reject(req.error);
        };
      }),
    { db: DB, table },
  );
}

async function openPalette(page: Page) {
  await page.locator('header button', { hasText: 'Suchen' }).click();
  return page.getByRole('combobox');
}

/** Types a sentence into the bar; "Eintragen" must be the first option. */
async function write(page: Page, sentence: string) {
  const box = await openPalette(page);
  await box.fill(sentence);
  await expect(page.getByRole('option').first()).toContainText('Eintragen');
  await box.press('Enter');
  await expect(page.getByTestId('ai-write-preview')).toBeVisible();
}

const INVOICE = {
  id: 'i1',
  payee: 'Stadtwerke Musterstadt',
  amountMinor: 8990,
  dueDate: '2026-10-05',
  status: 'open',
};
const SUBSCRIPTION = {
  id: 's1',
  name: 'Netflix',
  amountMinor: 1299,
  startDate: '2026-09-15',
  recurrence: { freq: 'monthly', interval: 1 },
  active: true,
};

test.describe('Eintragen per KI (Regeln, 0 Token)', () => {
  test('enters in three modules through the bar and undoes each', async ({ page }) => {
    const external: string[] = [];
    page.on('request', (r) => {
      if (!r.url().startsWith('http://localhost')) external.push(r.url());
    });
    await boot(page);

    const cases = [
      {
        sentence: 'Rechnung Stadtwerke 89,90 € fällig 15.10.',
        table: 'invoices_invoice',
        shows: ['Stadtwerke', '89,90 €'],
        check: (r: Record<string, unknown>) =>
          r.payee === 'Stadtwerke' && r.amountMinor === 8990 && r.dueDate === '2026-10-15',
      },
      {
        sentence: 'Aufgabe Steuererklärung abgeben bis 15.10.',
        table: 'todos_task',
        shows: ['Steuererklärung abgeben'],
        check: (r: Record<string, unknown>) =>
          r.title === 'Steuererklärung abgeben' && r.dueDate === '2026-10-15',
      },
      {
        sentence: 'Abo Netflix 12,99 € monatlich ab 1.11.',
        table: 'subscriptions_subscription',
        shows: ['Netflix', '12,99 €'],
        check: (r: Record<string, unknown>) =>
          r.name === 'Netflix' && r.amountMinor === 1299 && r.startDate === '2026-11-01',
      },
    ];

    for (const c of cases) {
      const before = (await rows(page, c.table)).length;
      await write(page, c.sentence);
      const preview = page.getByTestId('ai-write-preview');
      for (const text of c.shows) await expect(preview.getByText(text).first()).toBeVisible();
      await expect(page.getByTestId('ai-tier')).toHaveText('Regeln · 0 Token');
      expect(await rows(page, c.table)).toHaveLength(before); // nothing yet

      await page.getByTestId('ai-write-confirm').click();
      await expect(page.getByText('1 Änderung gespeichert.').first()).toBeVisible();
      const after = await rows(page, c.table);
      expect(after).toHaveLength(before + 1);
      expect(after.some(c.check)).toBe(true);

      await page.getByRole('button', { name: 'Rückgängig' }).click();
      await expect(page.getByText('Rückgängig gemacht.').first()).toBeVisible();
      expect(await rows(page, c.table)).toHaveLength(before);
    }
    expect(external).toEqual([]);
  });

  test('Enter confirms and Escape discards', async ({ page }) => {
    await boot(page);
    await write(page, 'Aufgabe Fenster putzen');
    await page.keyboard.press('Escape');
    await expect(page.getByRole('dialog')).toHaveCount(0);
    expect(await rows(page, 'todos_task')).toHaveLength(0);

    await write(page, 'Aufgabe Fenster putzen');
    await page.keyboard.press('Enter');
    await expect(page.getByText('1 Änderung gespeichert.').first()).toBeVisible();
    expect((await rows(page, 'todos_task')).map((r) => r.title)).toEqual(['Fenster putzen']);
  });

  test('shows before and after for a change and what a deletion removes, with undo', async ({
    page,
  }) => {
    await boot(page);
    await seed(page, { invoices_invoice: [INVOICE], subscriptions_subscription: [SUBSCRIPTION] });

    await write(page, 'Ändere den Betrag der Stadtwerke-Rechnung auf 95 €');
    const preview = page.getByTestId('ai-write-preview');
    await expect(preview.locator('del')).toContainText('89,90 €');
    await expect(preview.locator('ins')).toContainText('95,00 €');
    await page.getByTestId('ai-write-confirm').click();
    await expect(page.getByText('1 Änderung gespeichert.').first()).toBeVisible();
    expect((await rows(page, 'invoices_invoice'))[0]!.amountMinor).toBe(9500);
    await page.getByRole('button', { name: 'Rückgängig' }).click();
    await expect(page.getByText('Rückgängig gemacht.').first()).toBeVisible();
    expect((await rows(page, 'invoices_invoice'))[0]!.amountMinor).toBe(8990);

    await write(page, 'Lösche das Abo Netflix');
    await expect(page.getByTestId('ai-write-preview').getByText('Wird gelöscht')).toBeVisible();
    await expect(page.getByTestId('ai-write-preview').getByText('Netflix').first()).toBeVisible();
    await page.getByTestId('ai-write-confirm').click();
    await expect(page.getByText('1 Änderung gespeichert.').first()).toBeVisible();
    expect(await rows(page, 'subscriptions_subscription')).toHaveLength(0);
    await page.getByRole('button', { name: 'Rückgängig' }).click();
    await expect(page.getByText('Rückgängig gemacht.').first()).toBeVisible();
    expect(await rows(page, 'subscriptions_subscription')).toHaveLength(1);
  });

  test('marks an invoice as paid and books the expense; undo reverts both', async ({ page }) => {
    await boot(page);
    await seed(page, {
      invoices_invoice: [INVOICE],
      finance_account: [{ id: 'acc', name: 'Girokonto', openingBalanceMinor: 0, order: 0 }],
    });
    await write(page, 'Markiere die Stadtwerke-Rechnung als bezahlt');
    await expect(page.getByTestId('ai-write-preview').getByText('bezahlt').first()).toBeVisible();
    await page.getByTestId('ai-write-confirm').click();
    await expect(page.getByText('1 Änderung gespeichert.').first()).toBeVisible();
    await expect
      .poll(async () => (await rows(page, 'finance_transaction')).length)
      .toBeGreaterThan(0);
    expect((await rows(page, 'invoices_invoice'))[0]!.status).toBe('paid');
    await page.getByRole('button', { name: 'Rückgängig' }).click();
    await expect(page.getByText('Rückgängig gemacht.').first()).toBeVisible();
    expect((await rows(page, 'invoices_invoice'))[0]!.status).toBe('open');
    await expect.poll(async () => (await rows(page, 'finance_transaction')).length).toBe(0);
  });

  test('asks for a missing field in the preview before it can be saved', async ({ page }) => {
    await boot(page);
    await write(page, 'Rechnung Stadtwerke 89,90 €');
    const confirm = page.getByTestId('ai-write-confirm');
    await expect(page.getByText('Noch offen')).toBeVisible();
    await expect(confirm).toBeDisabled();
    await page.getByLabel('Fällig').fill('2026-10-20');
    await page.getByLabel('Fällig').blur();
    await expect(confirm).toBeEnabled();
    await confirm.click();
    await expect(page.getByText('1 Änderung gespeichert.').first()).toBeVisible();
    expect((await rows(page, 'invoices_invoice'))[0]!.dueDate).toBe('2026-10-20');
  });

  test('several entries in one input; unticking one leaves it out', async ({ page }) => {
    await boot(page);
    await write(page, 'Aufgabe Zahnarzt anrufen; Aufgabe Pakete abholen');
    await expect(page.getByTestId('ai-write-op')).toHaveCount(2);
    await page
      .getByRole('checkbox', { name: /Pakete abholen|Aufgabe anlegen/ })
      .last()
      .uncheck();
    await page.getByTestId('ai-write-confirm').click();
    await expect(page.getByText('1 Änderung gespeichert.').first()).toBeVisible();
    expect((await rows(page, 'todos_task')).map((r) => r.title)).toEqual(['Zahnarzt anrufen']);
  });

  test('"Mit KI eintragen" in a module opens the bar for entries', async ({ page }) => {
    await page.goto('/invoices');
    await expect(page.locator('main h1')).toBeVisible();
    await page.getByTestId('ai-write-button').click();
    const box = page.getByRole('combobox');
    await expect(box).toHaveAttribute('placeholder', /Rechnung Stadtwerke/);
    await box.fill('Telekom 39,99 € fällig 20.10.');
    await box.press('Enter');
    await expect(page.getByTestId('ai-write-preview')).toBeVisible();
    await expect(
      page.getByTestId('ai-write-preview').getByText('Rechnung anlegen', { exact: true }),
    ).toBeVisible();
  });

  test('can be switched off in the settings', async ({ page }) => {
    await page.goto('/settings/ki');
    await expect(page.getByRole('heading', { name: 'Eintragen per KI' })).toBeVisible();
    const toggle = page.getByRole('switch', { name: 'Einträge per KI vorschlagen' });
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await boot(page);
    const box = await openPalette(page);
    await box.fill('Aufgabe Fenster putzen');
    await expect(page.getByRole('option', { name: /^Eintragen/ })).toHaveCount(0);
    await box.press('Enter'); // the normal assistant answers instead of a preview
    await expect(page.getByTestId('ai-answer')).toBeVisible();
    await expect(page.getByTestId('ai-write-preview')).toHaveCount(0);
  });
});
