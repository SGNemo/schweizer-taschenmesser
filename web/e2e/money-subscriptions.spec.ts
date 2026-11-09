import { expect, test, type Page } from '@playwright/test';
import { moreFields, ready, showAllWidgets } from './helpers';

/** Deterministic "today": Tuesday 2026-09-29, 10:00 local time. */
test.beforeEach(async ({ page }) => {
  await showAllWidgets(page);
  await page.clock.setFixedTime(new Date('2026-09-29T10:00:00'));
});

async function save(page: Page) {
  await page.getByRole('dialog').getByRole('button', { name: 'Speichern' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
}

async function addSubscription(page: Page, name: string, amount: string, first: string) {
  await ready(page, '/subscriptions?new=1');
  const dialog = page.getByRole('dialog', { name: 'Abo hinzufügen' });
  await dialog.getByLabel('Name').fill(name);
  await dialog.getByLabel('Betrag').fill(amount);
  await dialog.getByLabel('Abbuchung am').fill(first);
  return dialog;
}

test.describe('Subscriptions: tiles, trial, category, price suggestion', () => {
  test('a subscription gets a tile, a head with the next charge and a monthly equivalent for a yearly one', async ({
    page,
  }) => {
    await addSubscription(page, 'Streaming Plus', '12,99', '2026-10-05');
    await save(page);
    await expect(page.getByTestId('next-charges-head')).toContainText('Streaming Plus');
    await expect(page.getByTestId('next-charges-head')).toContainText(/12,99\s€/);

    const yearly = await addSubscription(page, 'Jahres-Abo', '120,00', '2026-11-01');
    await yearly.getByLabel('Wiederholung').selectOption('yearly');
    await save(page);
    // A yearly 120,00 € is 10,00 € a month: said in the row.
    await expect(rows(page).filter({ hasText: 'Jahres-Abo' })).toContainText(/10,00\s€ \/ Monat/);
    await expect(page.getByTestId('total-month')).toBeVisible();
  });

  test('trial end, category and payment method are saved and shown; the trial gets a chip', async ({
    page,
  }) => {
    const dialog = await addSubscription(page, 'Musik Test', '9,99', '2026-10-10');
    await moreFields(page);
    await dialog.getByLabel('Probezeit endet am').fill('2026-10-02');
    await dialog.getByLabel('Art des Dienstes').selectOption({ label: 'Musik' });
    await dialog.getByLabel('Bezahlt mit').fill('Visa');
    await save(page);
    const row = rows(page).filter({ hasText: 'Musik Test' });
    await expect(row).toContainText('Probezeit');
    // The chip sits in the meta line: the amount column of a trial row lines up with the others (round 6, U56).
    await addSubscription(page, 'Hörbuch Flat', '7,49', '2026-10-12');
    await save(page);
    const amountEnd = async (name: string, amount: RegExp) => {
      const box = (await rows(page).filter({ hasText: name }).getByText(amount).boundingBox())!;
      return box.x + box.width;
    };
    expect(
      Math.abs(
        (await amountEnd('Musik Test', /^9,99\s€$/)) -
          (await amountEnd('Hörbuch Flat', /^7,49\s€$/)),
      ),
    ).toBeLessThanOrEqual(1);
    // Category and payment method show in Erweitert.
    await page.getByRole('switch', { name: 'Mehr Felder anzeigen' }).click();
    await expect(row).toContainText('Musik');
    await expect(row).toContainText('Visa');
    // The days left are said in the editor, next to the date.
    await row
      .getByRole('button', { name: /Musik Test/ })
      .first()
      .click();
    const again = page.getByRole('dialog', { name: 'Abo bearbeiten' });
    await moreFields(page);
    await expect(again.getByText('Probezeit endet in 3 Tagen')).toBeVisible();
  });

  test('finance offers the price seen in the bookings; taking it over changes the price', async ({
    page,
  }) => {
    await addSubscription(page, 'Streaming Plus', '12,99', '2026-09-05');
    await save(page);
    // Two bookings of the same new price (the two newest agree).
    for (const date of ['2026-08-05', '2026-09-05']) {
      await ready(page, '/finance?new=1');
      const d = page.getByRole('dialog', { name: 'Buchung hinzufügen' });
      await d.getByLabel('Betrag').fill('14,99');
      await d.getByLabel('Empfänger / Titel').fill('STREAMING PLUS 4711');
      await d.getByLabel('Datum').fill(date);
      await d
        .getByRole('dialog')
        .first()
        .isVisible()
        .catch(() => undefined);
      await save(page);
    }
    await ready(
      page,
      '/subscriptions?open=' + (await openIdOf(page, 'Streaming Plus')) + '&newprice=1499',
    );
    const editor = page.getByRole('dialog', { name: 'Abo bearbeiten' });
    await expect(editor.getByTestId('price-suggestion')).toContainText(/14,99\s€/);
    await editor.getByRole('button', { name: /Preis übernehmen/ }).click();
    await expect(editor.getByLabel('Betrag')).toHaveValue('14,99');
    await save(page);
    await expect(rows(page).filter({ hasText: 'Streaming Plus' })).toContainText(/14,99\s€/);
  });
});

/** The rows of the subscriptions list (not the tiles in the head). */
const rows = (page: Page) =>
  page.getByRole('list', { name: 'Abos', exact: true }).getByRole('listitem');

/** The id of a subscription row, read from IndexedDB (rows open through `?open=<id>`). */
async function openIdOf(page: Page, name: string): Promise<string> {
  return page.evaluate(
    (n) =>
      new Promise<string>((resolve, reject) => {
        const open = indexedDB.open('taschenmesser');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          const req = db
            .transaction('subscriptions_subscription')
            .objectStore('subscriptions_subscription')
            .getAll();
          req.onsuccess = () => {
            db.close();
            const row = (
              req.result as { id: string; name: string; deletedAt: number | null }[]
            ).find((r) => r.name === n && r.deletedAt === null);
            if (row) resolve(row.id);
            else reject(new Error('not found'));
          };
          req.onerror = () => reject(req.error);
        };
      }),
    name,
  );
}
